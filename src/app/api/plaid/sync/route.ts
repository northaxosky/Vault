import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { plaidClient } from "@/lib/plaid";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";

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

        // Build a map: plaidTransactionId -> { streamId, frequency }
        // Group by stream so we can batch-update efficiently.
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
