import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { plaidClient } from "@/lib/plaid";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { sendAlertEmail } from "@/lib/email";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Fetch all linked banks with their accounts.
    // We need the accounts to map Plaid's account_id to our Account.id.
    const plaidItems = await prisma.plaidItem.findMany({
      where: { userId: session.user.id },
      select: {
        id: true,
        accessToken: true,
        cursor: true,
        accounts: {
          select: { id: true, plaidAccountId: true },
        },
      },
    });

    let totalAdded = 0;
    let totalModified = 0;
    let totalRemoved = 0;

    // Fetch user's transaction rules once for applying during sync
    const rules = await prisma.transactionRule.findMany({
      where: { userId: session.user.id },
    });

    /** Apply matching rules to a transaction data object (mutates in-place). */
    function applyRules(txn: { name: string; merchantName: string | null; userCategory?: string | null }) {
      for (const rule of rules) {
        const fieldValue = rule.matchField === "merchantName" ? txn.merchantName : txn.name;
        if (fieldValue && fieldValue.toLowerCase().includes(rule.matchPattern.toLowerCase())) {
          if (rule.overrideName) txn.name = rule.overrideName;
          if (rule.overrideCategory) txn.userCategory = rule.overrideCategory;
          break; // first match wins
        }
      }
    }

    // Process each linked bank sequentially.
    // A typical user has 1-3 banks, so sequential is fine.
    for (const item of plaidItems) {
      const accessToken = decrypt(item.accessToken);

      // Build a lookup map: Plaid's account_id -> our Account.id
      // This avoids a DB query per transaction when mapping.
      const accountMap = new Map<string, string>();
      for (const acct of item.accounts) {
        accountMap.set(acct.plaidAccountId, acct.id);
      }

      // Cursor-based sync loop.
      // Empty string = "give me everything from the beginning" (first sync).
      // Saved cursor = "give me only what changed since last time".
      let cursor = item.cursor ?? "";
      let hasMore = true;

      while (hasMore) {
        const response = await plaidClient.transactionsSync({
          access_token: accessToken,
          cursor,
          count: 500, // max per page, reduces number of round-trips
        });

        const { added, modified, removed, next_cursor, has_more, accounts } =
          response.data;

        // --- ADDED: batch insert new transactions ---
        if (added.length > 0) {
          const mappedAdded = added
            .filter((txn) => accountMap.has(txn.account_id))
            .map((txn) => ({
              accountId: accountMap.get(txn.account_id)!,
              plaidTransactionId: txn.transaction_id,
              name: txn.merchant_name || txn.original_description || "",
              merchantName: txn.merchant_name || null,
              amount: txn.amount,
              date: new Date(txn.date),
              category: txn.personal_finance_category?.primary || null,
              subcategory: txn.personal_finance_category?.detailed || null,
              pending: txn.pending,
              currency: txn.iso_currency_code || "USD",
            }));

          // Apply user's transaction rules to new transactions
          for (const txn of mappedAdded) {
            applyRules(txn);
          }

          await prisma.transaction.createMany({
            data: mappedAdded,
            skipDuplicates: true, // safe if we re-process a transaction
          });
          totalAdded += mappedAdded.length;
        }

        // --- MODIFIED: upsert each changed transaction ---
        // Using upsert instead of update handles the case where a "modified"
        // transaction was never seen as "added" (e.g., cursor was reset).
        for (const txn of modified) {
          const ourAccountId = accountMap.get(txn.account_id);
          if (!ourAccountId) continue;

          const txnData = {
            accountId: ourAccountId,
            name: txn.merchant_name || txn.original_description || "",
            merchantName: txn.merchant_name || null,
            amount: txn.amount,
            date: new Date(txn.date),
            category: txn.personal_finance_category?.primary || null,
            subcategory: txn.personal_finance_category?.detailed || null,
            pending: txn.pending,
            currency: txn.iso_currency_code || "USD",
          };

          // Apply user's transaction rules to modified transactions
          applyRules(txnData);

          await prisma.transaction.upsert({
            where: { plaidTransactionId: txn.transaction_id },
            update: txnData,
            create: { ...txnData, plaidTransactionId: txn.transaction_id },
          });
        }
        totalModified += modified.length;

        // --- REMOVED: batch delete ---
        if (removed.length > 0) {
          await prisma.transaction.deleteMany({
            where: {
              plaidTransactionId: {
                in: removed.map((r) => r.transaction_id),
              },
            },
          });
          totalRemoved += removed.length;
        }

        // --- Update account balances from the sync response ---
        // The sync response includes fresh balance data for each account.
        if (accounts) {
          const today = new Date();
          today.setHours(0, 0, 0, 0); // strip time for a clean daily bucket

          for (const acct of accounts) {
            const ourAccountId = accountMap.get(acct.account_id);
            if (ourAccountId) {
              await prisma.account.update({
                where: { id: ourAccountId },
                data: {
                  currentBalance: acct.balances.current,
                  availableBalance: acct.balances.available,
                },
              });

              // --- Capture daily balance snapshot ---
              // One snapshot per account per day. If the user syncs multiple
              // times today, we overwrite with the latest balance.
              if (acct.balances.current != null) {
                const existing = await prisma.balanceSnapshot.findFirst({
                  where: { accountId: ourAccountId, date: today },
                });

                if (existing) {
                  await prisma.balanceSnapshot.update({
                    where: { id: existing.id },
                    data: { balance: acct.balances.current },
                  });
                } else {
                  await prisma.balanceSnapshot.create({
                    data: {
                      accountId: ourAccountId,
                      date: today,
                      balance: acct.balances.current,
                    },
                  });
                }
              }
            }
          }
        }

        cursor = next_cursor;
        hasMore = has_more;
      }

      // Persist the cursor so the next sync only fetches changes.
      await prisma.plaidItem.update({
        where: { id: item.id },
        data: { cursor },
      });

      // --- Recurring transaction detection ---
      // Plaid identifies recurring streams (subscriptions, regular bills,
      // paychecks) and tells us which transactions belong to each stream.
      // This is a separate API call, not part of transactionsSync.
      try {
        const recurringResponse = await plaidClient.transactionsRecurringGet({
          access_token: accessToken,
          account_ids: [...accountMap.keys()],
        });

        const { inflow_streams, outflow_streams } = recurringResponse.data;
        const allStreams = [...inflow_streams, ...outflow_streams];

        // --- Upsert RecurringStream records ---
        // Persist stream-level metadata (average amount, predicted next date,
        // merchant name, etc.) that powers the subscriptions page and bill calendar.
        const syncedStreamIds: string[] = [];

        for (const stream of allStreams) {
          const ourAccountId = accountMap.get(stream.account_id);
          if (!ourAccountId) continue;

          syncedStreamIds.push(stream.stream_id);

          const streamType = inflow_streams.includes(stream) ? "INFLOW" : "OUTFLOW";

          const streamData = {
            accountId: ourAccountId,
            merchantName: stream.merchant_name || null,
            description: stream.description,
            category: stream.personal_finance_category?.primary || null,
            subcategory: stream.personal_finance_category?.detailed || null,
            firstDate: new Date(stream.first_date),
            lastDate: new Date(stream.last_date),
            lastAmount: stream.last_amount.amount ?? 0,
            averageAmount: stream.average_amount.amount ?? 0,
            predictedNextDate: stream.predicted_next_date
              ? new Date(stream.predicted_next_date)
              : null,
            frequency: String(stream.frequency),
            isActive: stream.is_active,
            status: String(stream.status),
            streamType,
            currency: stream.last_amount.iso_currency_code || "USD",
          };

          // Preserve user's cancellation override across syncs
          const existingStream = await prisma.recurringStream.findUnique({
            where: { plaidStreamId: stream.stream_id },
            select: { cancelledByUser: true, cancelledAt: true },
          });

          await prisma.recurringStream.upsert({
            where: { plaidStreamId: stream.stream_id },
            update: {
              ...streamData,
              cancelledByUser: existingStream?.cancelledByUser ?? false,
              cancelledAt: existingStream?.cancelledAt ?? null,
            },
            create: {
              plaidStreamId: stream.stream_id,
              ...streamData,
            },
          });
        }

        // Remove streams Plaid no longer returns, but keep user-cancelled ones
        const syncedAccountIds = [...accountMap.values()];
        if (syncedAccountIds.length > 0 && syncedStreamIds.length > 0) {
          await prisma.recurringStream.deleteMany({
            where: {
              accountId: { in: syncedAccountIds },
              plaidStreamId: { notIn: syncedStreamIds },
              cancelledByUser: false,
            },
          });
        }

        // --- Update per-transaction recurring flags ---
        // These flags power the "Recurring" badges on the transactions page.
        const txnIdsByStream = new Map<string, { plaidTxnIds: string[]; frequency: string }>();

        for (const stream of allStreams) {
          if (!stream.is_active) continue;
          const key = stream.stream_id;
          const entry = txnIdsByStream.get(key) ?? {
            plaidTxnIds: [],
            frequency: String(stream.frequency),
          };
          for (const txnId of stream.transaction_ids) {
            entry.plaidTxnIds.push(txnId);
          }
          txnIdsByStream.set(key, entry);
        }

        if (txnIdsByStream.size > 0) {
          // Reset: clear recurring flags for all transactions in these accounts
          await prisma.transaction.updateMany({
            where: {
              accountId: { in: [...accountMap.values()] },
            },
            data: {
              isRecurring: false,
              recurringStreamId: null,
              recurringFrequency: null,
            },
          });

          // Set: mark identified transactions as recurring (one batch per stream)
          for (const [streamId, { plaidTxnIds, frequency }] of txnIdsByStream) {
            await prisma.transaction.updateMany({
              where: { plaidTransactionId: { in: plaidTxnIds } },
              data: {
                isRecurring: true,
                recurringStreamId: streamId,
                recurringFrequency: frequency,
              },
            });
          }
        }
      } catch {
        // Expected to fail if the Plaid item doesn't support transactions
        // or if the feature isn't available in sandbox. Silently skip.
      }

      // --- Investment holdings sync ---
      // Unlike transactions, investments aren't cursor-based.
      // investmentsHoldingsGet returns a full snapshot each time,
      // so we upsert everything and remove stale holdings.
      // Wrapped in try/catch because items linked before we added
      // Products.Investments will fail — that's expected.
      try {
        const investResponse = await plaidClient.investmentsHoldingsGet({
          access_token: accessToken,
        });

        const { holdings, securities } = investResponse.data;

        // Build a lookup: Plaid security_id → our Security record id
        const securityMap = new Map<string, string>();

        for (const sec of securities) {
          const upserted = await prisma.security.upsert({
            where: { plaidSecurityId: sec.security_id },
            update: {
              name: sec.name ?? undefined,
              ticker: sec.ticker_symbol ?? undefined,
              type: sec.type ?? undefined,
            },
            create: {
              plaidSecurityId: sec.security_id,
              name: sec.name ?? undefined,
              ticker: sec.ticker_symbol ?? undefined,
              type: sec.type ?? undefined,
            },
          });
          securityMap.set(sec.security_id, upserted.id);
        }

        // Track which holdings we upserted so we can clean up stale ones
        const upsertedHoldingIds: string[] = [];

        for (const holding of holdings) {
          const ourAccountId = accountMap.get(holding.account_id);
          const ourSecurityId = securityMap.get(holding.security_id);
          if (!ourAccountId || !ourSecurityId) continue;

          // Manual upsert: Prisma v7 doesn't expose the @@unique compound
          // key in upsert's WhereUniqueInput, so we find + update/create instead.
          const existing = await prisma.investmentHolding.findFirst({
            where: { accountId: ourAccountId, securityId: ourSecurityId },
            select: { id: true },
          });

          const holdingData = {
            quantity: holding.quantity,
            costBasis: holding.cost_basis,
            currentValue: holding.institution_value,
            currency: holding.iso_currency_code || "USD",
          };

          let holdingId: string;
          if (existing) {
            await prisma.investmentHolding.update({
              where: { id: existing.id },
              data: holdingData,
            });
            holdingId = existing.id;
          } else {
            const created = await prisma.investmentHolding.create({
              data: {
                accountId: ourAccountId,
                securityId: ourSecurityId,
                ...holdingData,
              },
            });
            holdingId = created.id;
          }
          upsertedHoldingIds.push(holdingId);
        }

        // Remove holdings that no longer exist (user sold the position).
        // Only delete from accounts we just synced, not all accounts.
        const syncedAccountIds = [...accountMap.values()];
        if (syncedAccountIds.length > 0) {
          await prisma.investmentHolding.deleteMany({
            where: {
              accountId: { in: syncedAccountIds },
              id: { notIn: upsertedHoldingIds },
            },
          });
        }
      } catch {
        // Expected for items without investment access — silently skip
      }
    }

    // --- Smart Alert Generation ---
    // Check user settings for alert thresholds and generate alerts for:
    // 1. Large transactions (amount > spendingAlert threshold)
    // 2. Low balance accounts (balance < lowBalanceAlert threshold)
    // 3. Budget overspend (monthly spending > budget amount)
    try {
      const userSettings = await prisma.userSettings.findUnique({
        where: { userId: session.user.id },
        select: { spendingAlert: true, lowBalanceAlert: true, emailAlerts: true },
      });

      if (userSettings?.emailAlerts) {
        const alertsToCreate: {
          userId: string;
          type: string;
          title: string;
          message: string;
          transactionId?: string;
        }[] = [];

        // 1. LARGE_TRANSACTION: check newly added transactions
        if (userSettings.spendingAlert && totalAdded > 0) {
          const threshold = Number(userSettings.spendingAlert);
          // Get recent transactions added in this sync (last 10 minutes)
          const recentCutoff = new Date(Date.now() - 10 * 60 * 1000);
          const largeTransactions = await prisma.transaction.findMany({
            where: {
              account: { plaidItem: { userId: session.user.id } },
              amount: { gte: threshold },
              createdAt: { gte: recentCutoff },
            },
            select: { id: true, name: true, merchantName: true, amount: true, currency: true },
            take: 10,
          });

          for (const txn of largeTransactions) {
            // Avoid duplicates: check if alert already exists for this transaction
            const exists = await prisma.alert.findFirst({
              where: { userId: session.user.id, type: "LARGE_TRANSACTION", transactionId: txn.id },
            });
            if (!exists) {
              const displayName = txn.merchantName || txn.name;
              alertsToCreate.push({
                userId: session.user.id,
                type: "LARGE_TRANSACTION",
                title: "Large transaction detected",
                message: `${displayName}: $${Number(txn.amount).toFixed(2)} ${txn.currency}`,
                transactionId: txn.id,
              });
            }
          }
        }

        // 2. LOW_BALANCE: check all accounts
        if (userSettings.lowBalanceAlert) {
          const threshold = Number(userSettings.lowBalanceAlert);
          const lowAccounts = await prisma.account.findMany({
            where: {
              plaidItem: { userId: session.user.id },
              type: { in: ["depository"] },
              currentBalance: { lt: threshold },
            },
            select: { id: true, name: true, currentBalance: true, currency: true },
          });

          for (const acc of lowAccounts) {
            // One alert per account per day
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const exists = await prisma.alert.findFirst({
              where: {
                userId: session.user.id,
                type: "LOW_BALANCE",
                message: { contains: acc.name },
                createdAt: { gte: today },
              },
            });
            if (!exists) {
              alertsToCreate.push({
                userId: session.user.id,
                type: "LOW_BALANCE",
                title: "Low balance warning",
                message: `${acc.name} balance is $${Number(acc.currentBalance).toFixed(2)} ${acc.currency}`,
              });
            }
          }
        }

        // 3. BUDGET_OVERSPEND: check each budget this month
        const budgets = await prisma.budget.findMany({
          where: { userId: session.user.id },
        });

        if (budgets.length > 0) {
          const monthStart = new Date();
          monthStart.setDate(1);
          monthStart.setHours(0, 0, 0, 0);

          for (const budget of budgets) {
            const spending = await prisma.transaction.aggregate({
              where: {
                account: { plaidItem: { userId: session.user.id } },
                date: { gte: monthStart },
                amount: { gt: 0 }, // only expenses
                OR: [
                  { userCategory: budget.category },
                  { userCategory: null, category: budget.category },
                ],
              },
              _sum: { amount: true },
            });

            const totalSpent = Number(spending._sum.amount ?? 0);
            const limit = Number(budget.amount);

            if (totalSpent > limit) {
              // One alert per budget per month
              const exists = await prisma.alert.findFirst({
                where: {
                  userId: session.user.id,
                  type: "BUDGET_OVERSPEND",
                  message: { contains: budget.category },
                  createdAt: { gte: monthStart },
                },
              });
              if (!exists) {
                alertsToCreate.push({
                  userId: session.user.id,
                  type: "BUDGET_OVERSPEND",
                  title: "Budget exceeded",
                  message: `${budget.category}: $${totalSpent.toFixed(2)} spent of $${limit.toFixed(2)} budget`,
                });
              }
            }
          }
        }

        // Batch create all alerts
        if (alertsToCreate.length > 0) {
          await prisma.alert.createMany({ data: alertsToCreate });

          // Send email notifications for each alert (non-blocking)
          const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { email: true },
          });
          if (user?.email) {
            for (const alert of alertsToCreate) {
              try {
                await sendAlertEmail(user.email, alert);
              } catch (emailError) {
                console.error("[email] Failed to send alert email:", emailError);
              }
            }
          }
        }
      }
    } catch (alertError) {
      // Alert generation is non-critical — don't fail the sync
      console.error("Alert generation error:", alertError);
    }

    return NextResponse.json({
      success: true,
      added: totalAdded,
      modified: totalModified,
      removed: totalRemoved,
    });
  } catch (error) {
    console.error("Error syncing:", error);
    return NextResponse.json(
      { error: "Failed to sync" },
      { status: 500 }
    );
  }
}
