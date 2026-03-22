import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import BudgetsClient from "@/components/BudgetsClient";

export default async function BudgetsPage() {
  const session = await auth();

  // Fetch user's budgets
  const budgets = await prisma.budget.findMany({
    where: { userId: session!.user.id },
    orderBy: { category: "asc" },
  });

  // Fetch current month's spending grouped by category
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const rawMonthTxns = await prisma.transaction.findMany({
    where: {
      account: { plaidItem: { userId: session!.user.id } },
      date: { gte: monthStart },
      amount: { gt: 0 }, // spending only
    },
    select: {
      amount: true,
      category: true,
    },
  });

  // Group spending by category
  const spendingMap = new Map<string, number>();
  for (const txn of rawMonthTxns) {
    const cat = txn.category || "OTHER";
    spendingMap.set(cat, (spendingMap.get(cat) || 0) + Number(txn.amount));
  }

  return (
    <BudgetsClient
      budgets={budgets.map((b) => ({
        id: b.id,
        category: b.category,
        amount: Number(b.amount),
      }))}
      categorySpending={Object.fromEntries(spendingMap)}
    />
  );
}
