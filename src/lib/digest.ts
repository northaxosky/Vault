import { prisma } from "@/lib/prisma";
import type { WeeklyDigestData } from "@/types/digest";

export async function generateWeeklyDigest(
  userId: string
): Promise<WeeklyDigestData> {
  // 1. Get user info
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });

  // 2. Calculate period: last 7 days
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setHours(23, 59, 59, 999);
  const periodStart = new Date(now);
  periodStart.setDate(periodStart.getDate() - 7);
  periodStart.setHours(0, 0, 0, 0);
  const prevWeekStart = new Date(periodStart);
  prevWeekStart.setDate(prevWeekStart.getDate() - 7);

  // 3. This week's transactions (positive amounts = spending in Plaid convention)
  const thisWeekTxns = await prisma.transaction.findMany({
    where: {
      account: { plaidItem: { userId } },
      date: { gte: periodStart, lte: periodEnd },
      amount: { gt: 0 },
    },
    select: { amount: true, category: true },
  });

  const totalSpending = thisWeekTxns.reduce(
    (sum, t) => sum + Number(t.amount),
    0
  );

  // 4. Previous week spending for comparison
  const prevWeekTxns = await prisma.transaction.aggregate({
    where: {
      account: { plaidItem: { userId } },
      date: { gte: prevWeekStart, lt: periodStart },
      amount: { gt: 0 },
    },
    _sum: { amount: true },
  });
  const previousWeekSpending = Number(prevWeekTxns._sum.amount ?? 0);
  const spendingChange =
    previousWeekSpending > 0
      ? ((totalSpending - previousWeekSpending) / previousWeekSpending) * 100
      : 0;

  // 5. Top categories (top 5)
  const catMap = new Map<string, number>();
  for (const t of thisWeekTxns) {
    const cat = t.category || "OTHER";
    catMap.set(cat, (catMap.get(cat) || 0) + Number(t.amount));
  }
  const topCategories = Array.from(catMap.entries())
    .map(([category, total]) => ({
      category,
      total: Math.round(total * 100) / 100,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // 6. Upcoming recurring charges (next 7 days)
  const nextWeek = new Date(now);
  nextWeek.setDate(nextWeek.getDate() + 7);
  const recurring = await prisma.recurringStream.findMany({
    where: {
      account: { plaidItem: { userId } },
      isActive: true,
      cancelledByUser: false,
      predictedNextDate: { gte: now, lte: nextWeek },
    },
    select: {
      merchantName: true,
      description: true,
      lastAmount: true,
      predictedNextDate: true,
    },
    orderBy: { predictedNextDate: "asc" },
    take: 10,
  });
  const upcomingRecurring = recurring.map((r) => ({
    name: r.merchantName || r.description,
    amount: Number(r.lastAmount),
    date: r.predictedNextDate!.toISOString(),
  }));

  // 7. Budget status (current month)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const budgets = await prisma.budget.findMany({ where: { userId } });
  const budgetStatus = [];
  for (const b of budgets) {
    const spent = await prisma.transaction.aggregate({
      where: {
        account: { plaidItem: { userId } },
        date: { gte: monthStart },
        amount: { gt: 0 },
        OR: [
          { userCategory: b.category },
          { userCategory: null, category: b.category },
        ],
      },
      _sum: { amount: true },
    });
    const spentAmount = Number(spent._sum.amount ?? 0);
    const limit = Number(b.amount);
    budgetStatus.push({
      category: b.category,
      spent: Math.round(spentAmount * 100) / 100,
      limit,
      percentage: limit > 0 ? Math.round((spentAmount / limit) * 100) : 0,
    });
  }

  // 8. Account balances
  const accounts = await prisma.account.findMany({
    where: { plaidItem: { userId } },
    select: { name: true, type: true, currentBalance: true },
    orderBy: { type: "asc" },
  });
  const accountSummary = accounts.map((a) => ({
    name: a.name,
    type: a.type,
    balance: Number(a.currentBalance ?? 0),
  }));

  // 9. Alert count this week
  const alertCount = await prisma.alert.count({
    where: { userId, createdAt: { gte: periodStart } },
  });

  return {
    userName: user?.name ?? null,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    totalSpending: Math.round(totalSpending * 100) / 100,
    previousWeekSpending: Math.round(previousWeekSpending * 100) / 100,
    spendingChange: Math.round(spendingChange * 10) / 10,
    topCategories,
    upcomingRecurring,
    budgetStatus,
    accountSummary,
    alertCount,
  };
}
