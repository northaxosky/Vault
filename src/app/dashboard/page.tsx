import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import DashboardClient from "@/components/DashboardClient";

export default async function DashboardPage() {
  const session = await auth();

  // Fetch all linked institutions with their accounts and balances.
  // The layout already guarantees we're logged in, but we still need
  // the session to know *which* user's data to query.
  const plaidItems = await prisma.plaidItem.findMany({
    where: { userId: session!.user.id },
    select: {
      id: true,
      institutionName: true,
      createdAt: true,
      accounts: {
        select: {
          id: true,
          name: true,
          officialName: true,
          type: true,
          subtype: true,
          currentBalance: true,
          availableBalance: true,
          currency: true,
        },
        orderBy: { name: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Compute summary metrics server-side.
  // We do this here (not in the client) because Prisma Decimal types
  // must be converted to plain numbers before crossing the
  // server → client boundary.
  let netWorth = 0;
  let cashTotal = 0; // checking + savings (Plaid type: "depository")
  let creditTotal = 0; // credit cards (amount owed)
  let totalAccounts = 0;

  for (const item of plaidItems) {
    for (const account of item.accounts) {
      totalAccounts++;
      const balance = account.currentBalance
        ? Number(account.currentBalance)
        : 0;

      if (account.type === "credit") {
        // Plaid reports credit balances as positive = money owed
        creditTotal += balance;
        netWorth -= balance;
      } else {
        // Depository (checking/savings), investment, loan, etc.
        if (account.type === "depository") {
          cashTotal += balance;
        }
        netWorth += balance;
      }
    }
  }

  // Serialize for the client component:
  // - Decimal → Number()
  // - DateTime → .toISOString()
  const institutions = plaidItems.map((item) => ({
    id: item.id,
    institutionName: item.institutionName,
    createdAt: item.createdAt.toISOString(),
    accounts: item.accounts.map((acc) => ({
      id: acc.id,
      name: acc.name,
      officialName: acc.officialName,
      type: acc.type,
      subtype: acc.subtype,
      currentBalance: acc.currentBalance ? Number(acc.currentBalance) : null,
      availableBalance: acc.availableBalance
        ? Number(acc.availableBalance)
        : null,
      currency: acc.currency,
    })),
  }));

  // Fetch the 10 most recent transactions for the "Recent Transactions" section.
  const rawRecentTxns = await prisma.transaction.findMany({
    where: {
      account: { plaidItem: { userId: session!.user.id } },
    },
    select: {
      id: true,
      name: true,
      merchantName: true,
      amount: true,
      date: true,
      category: true,
      subcategory: true,
      pending: true,
      currency: true,
      account: { select: { name: true } },
    },
    orderBy: { date: "desc" },
    take: 10,
  });

  const recentTransactions = rawRecentTxns.map((txn) => ({
    id: txn.id,
    name: txn.name,
    merchantName: txn.merchantName,
    amount: Number(txn.amount),
    date: txn.date.toISOString(),
    category: txn.category,
    subcategory: txn.subcategory,
    pending: txn.pending,
    currency: txn.currency,
    accountName: txn.account.name,
  }));

  // Fetch current month's spending grouped by category for the pie chart.
  // Plaid convention: positive amount = money spent, negative = income.
  // We only want spending (positive amounts) and group by category.
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const rawMonthTxns = await prisma.transaction.findMany({
    where: {
      account: { plaidItem: { userId: session!.user.id } },
      date: { gte: monthStart },
      amount: { gt: 0 }, // spending only (Plaid: positive = outflow)
    },
    select: {
      amount: true,
      category: true,
    },
  });

  // Group by category and sum amounts
  const spendingMap = new Map<string, number>();
  for (const txn of rawMonthTxns) {
    const cat = txn.category || "OTHER";
    spendingMap.set(cat, (spendingMap.get(cat) || 0) + Number(txn.amount));
  }

  const categorySpending = Array.from(spendingMap.entries())
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);

  // Fetch transactions from the last 6 months for the trend chart.
  // Lightweight query: only amount + date. We aggregate by day in
  // TypeScript to produce spending, income, and cash-flow series.
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const rawTrendTxns = await prisma.transaction.findMany({
    where: {
      account: { plaidItem: { userId: session!.user.id } },
      date: { gte: sixMonthsAgo },
    },
    select: {
      amount: true,
      date: true,
    },
    orderBy: { date: "asc" },
  });

  // Aggregate by day: spending (positive amounts) vs income (|negative|).
  const dailyMap = new Map<string, { spending: number; income: number }>();
  for (const txn of rawTrendTxns) {
    const dayKey = txn.date.toISOString().slice(0, 10);
    const entry = dailyMap.get(dayKey) || { spending: 0, income: 0 };
    const amount = Number(txn.amount);
    if (amount > 0) {
      entry.spending += amount;
    } else {
      entry.income += Math.abs(amount);
    }
    dailyMap.set(dayKey, entry);
  }

  const dailyTrend = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({
      date,
      spending: Math.round(data.spending * 100) / 100,
      income: Math.round(data.income * 100) / 100,
      cashFlow: Math.round((data.income - data.spending) * 100) / 100,
    }));

  return (
    <DashboardClient
      summary={{ netWorth, cashTotal, creditTotal, totalAccounts }}
      institutions={institutions}
      recentTransactions={recentTransactions}
      categorySpending={categorySpending}
      dailyTrend={dailyTrend}
    />
  );
}
