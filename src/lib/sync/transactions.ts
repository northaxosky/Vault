import { plaidClient } from "@/lib/plaid";
import type { SyncContext, TransactionSyncResult } from "./types";

/**
 * Apply the first matching transaction rule to a transaction (mutates in-place).
 * Rules are checked in order; first match wins.
 */
function applyRules(
  txn: { name: string; merchantName: string | null; userCategory?: string | null },
  rules: SyncContext["rules"],
): void {
  for (const rule of rules) {
    const fieldValue = rule.matchField === "merchantName" ? txn.merchantName : txn.name;
    if (fieldValue && fieldValue.toLowerCase().includes(rule.matchPattern.toLowerCase())) {
      if (rule.overrideName) txn.name = rule.overrideName;
      if (rule.overrideCategory) txn.userCategory = rule.overrideCategory;
      break;
    }
  }
}

/**
 * Cursor-based transaction sync for a single Plaid item.
 * Fetches added/modified/removed transactions, applies user rules,
 * updates account balances, and captures daily balance snapshots.
 *
 * Returns the accumulated counts and persists the new cursor.
 */
export async function syncTransactions(ctx: SyncContext): Promise<TransactionSyncResult> {
  const { prisma, accessToken, plaidItemId, accountMap, rules } = ctx;

  let cursor = ctx.cursor;

  let hasMore = true;
  let totalAdded = 0;
  let totalModified = 0;
  let totalRemoved = 0;

  while (hasMore) {
    const response = await plaidClient.transactionsSync({
      access_token: accessToken,
      cursor,
      count: 500,
    });

    const { added, modified, removed, next_cursor, has_more, accounts } = response.data;

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

      for (const txn of mappedAdded) {
        applyRules(txn, rules);
      }

      await prisma.transaction.createMany({
        data: mappedAdded,
        skipDuplicates: true,
      });
      totalAdded += mappedAdded.length;
    }

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

      applyRules(txnData, rules);

      await prisma.transaction.upsert({
        where: { plaidTransactionId: txn.transaction_id },
        update: txnData,
        create: { ...txnData, plaidTransactionId: txn.transaction_id },
      });
    }
    totalModified += modified.length;

    if (removed.length > 0) {
      await prisma.transaction.deleteMany({
        where: {
          plaidTransactionId: { in: removed.map((r) => r.transaction_id) },
        },
      });
      totalRemoved += removed.length;
    }

    if (accounts) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (const acct of accounts) {
        const ourAccountId = accountMap.get(acct.account_id);
        if (!ourAccountId) continue;

        await prisma.account.update({
          where: { id: ourAccountId },
          data: {
            currentBalance: acct.balances.current,
            availableBalance: acct.balances.available,
          },
        });

        // One snapshot per account per day — upsert on @@unique([accountId, date])
        if (acct.balances.current != null) {
          await prisma.balanceSnapshot.upsert({
            where: {
              accountId_date: { accountId: ourAccountId, date: today },
            },
            update: { balance: acct.balances.current },
            create: {
              accountId: ourAccountId,
              date: today,
              balance: acct.balances.current,
            },
          });
        }
      }
    }

    cursor = next_cursor;
    hasMore = has_more;
  }

  // Persist cursor for next sync
  await prisma.plaidItem.update({
    where: { id: plaidItemId },
    data: { cursor },
  });

  return { added: totalAdded, modified: totalModified, removed: totalRemoved };
}
