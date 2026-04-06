import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { logPlaidError } from "@/lib/plaid";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { isDemoMode } from "@/lib/demo";
import { syncTransactions } from "@/lib/sync/transactions";
import { syncRecurring } from "@/lib/sync/recurring";
import { syncInvestments } from "@/lib/sync/investments";
import { generateAlerts } from "@/lib/sync/alerts";
import type { AccountMap, SyncContext, ItemSyncResult, TransactionSyncResult } from "@/lib/sync/types";

/** Process a single Plaid item: transactions, recurring, investments. */
async function syncItem(ctx: SyncContext): Promise<ItemSyncResult> {
  const result: ItemSyncResult = {
    itemId: ctx.plaidItemId,
    transactions: { added: 0, modified: 0, removed: 0 },
    recurringOk: false,
    investmentsOk: false,
  };

  try {
    // Transactions must complete first (recurring/investments depend on synced data)
    result.transactions = await syncTransactions(ctx);

    // Recurring and investment syncs are independent — run in parallel
    const [recurringResult, investResult] = await Promise.allSettled([
      syncRecurring(ctx),
      syncInvestments(ctx),
    ]);
    result.recurringOk = recurringResult.status === "fulfilled" && recurringResult.value;
    result.investmentsOk = investResult.status === "fulfilled" && investResult.value;
  } catch (error) {
    logPlaidError(`sync/item ${ctx.plaidItemId}`, error);
    result.error = error instanceof Error ? error.message : "Unknown error";
  }

  return result;
}

export async function POST() {
  if (isDemoMode()) {
    return NextResponse.json({ success: true, message: "Demo mode - sync skipped" });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
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

    // Fetch user's transaction rules once for all items
    const rules = await prisma.transactionRule.findMany({
      where: { userId: session.user.id },
    });

    // Process all Plaid items in parallel
    const itemResults = await Promise.allSettled(
      plaidItems.map((item) => {
        const accountMap: AccountMap = new Map(
          item.accounts.map((acct) => [acct.plaidAccountId, acct.id]),
        );

        const ctx: SyncContext = {
          prisma,
          userId: session.user!.id!,
          accessToken: decrypt(item.accessToken),
          plaidItemId: item.id,
          cursor: item.cursor ?? "",
          accountMap,
          rules,
        };

        return syncItem(ctx);
      }),
    );

    // Aggregate results across all items
    const totals: TransactionSyncResult = { added: 0, modified: 0, removed: 0 };
    for (const settled of itemResults) {
      if (settled.status === "fulfilled") {
        totals.added += settled.value.transactions.added;
        totals.modified += settled.value.transactions.modified;
        totals.removed += settled.value.transactions.removed;
      }
    }

    // Generate alerts based on the synced data
    await generateAlerts(prisma, session.user.id, totals.added);

    return NextResponse.json({
      success: true,
      added: totals.added,
      modified: totals.modified,
      removed: totals.removed,
    });
  } catch (error) {
    logPlaidError("sync", error);
    return NextResponse.json(
      { error: "Failed to sync" },
      { status: 500 },
    );
  }
}
