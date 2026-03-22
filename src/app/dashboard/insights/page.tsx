import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import InsightsClient from "@/components/InsightsClient";

export default async function InsightsPage() {
  const session = await auth();

  // Last 13 months of data for month-over-month comparisons
  const thirteenMonthsAgo = new Date();
  thirteenMonthsAgo.setMonth(thirteenMonthsAgo.getMonth() - 13);

  // Get all user account IDs
  const userAccounts = await prisma.account.findMany({
    where: { plaidItem: { userId: session!.user.id } },
    select: { id: true, type: true, currentBalance: true },
  });
  const accountIds = userAccounts.map((a) => a.id);

  // --- Transactions (last 13 months) ---
  const rawTransactions = await prisma.transaction.findMany({
    where: {
      accountId: { in: accountIds },
      date: { gte: thirteenMonthsAgo },
      pending: false,
    },
    select: {
      amount: true,
      date: true,
      category: true,
      merchantName: true,
      name: true,
    },
    orderBy: { date: "desc" },
  });

  const transactions = rawTransactions.map((t) => ({
    amount: Number(t.amount),
    date: t.date.toISOString(),
    category: t.category,
    merchantName: t.merchantName,
    name: t.name,
  }));

  // --- Budgets ---
  const rawBudgets = await prisma.budget.findMany({
    where: { userId: session!.user.id },
  });

  const budgets = rawBudgets.map((b) => ({
    category: b.category,
    amount: Number(b.amount),
  }));

  // --- Balance Snapshots (last 13 months) ---
  const rawSnapshots = await prisma.balanceSnapshot.findMany({
    where: {
      accountId: { in: accountIds },
      date: { gte: thirteenMonthsAgo },
    },
    select: {
      date: true,
      balance: true,
      account: { select: { type: true } },
    },
    orderBy: { date: "asc" },
  });

  const snapshots = rawSnapshots.map((s) => ({
    date: s.date.toISOString(),
    balance: Number(s.balance),
    accountType: s.account.type,
  }));

  // --- Current net worth ---
  let currentNetWorth = 0;
  for (const acct of userAccounts) {
    const bal = Number(acct.currentBalance ?? 0);
    if (acct.type === "credit") {
      currentNetWorth -= bal;
    } else {
      currentNetWorth += bal;
    }
  }

  return (
    <InsightsClient
      transactions={transactions}
      budgets={budgets}
      snapshots={snapshots}
      currentNetWorth={currentNetWorth}
    />
  );
}
