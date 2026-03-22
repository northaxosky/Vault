import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AnalyticsClient from "@/components/AnalyticsClient";
import AnalyticsSkeleton from "@/components/AnalyticsSkeleton";
import { Suspense } from "react";

async function AnalyticsContent() {
  const session = await auth();

  // Fetch transactions from the last 24 months
  const twoYearsAgo = new Date();
  twoYearsAgo.setMonth(twoYearsAgo.getMonth() - 24);

  const transactions = await prisma.transaction.findMany({
    where: {
      account: {
        plaidItem: { userId: session!.user.id },
      },
      date: {
        gte: twoYearsAgo,
      },
    },
    select: {
      id: true,
      amount: true,
      date: true,
      category: true,
      merchantName: true,
      account: { select: { id: true, name: true } },
    },
    orderBy: { date: "desc" },
  });

  // Fetch budgets for the user
  const budgets = await prisma.budget.findMany({
    where: { userId: session!.user.id },
    select: { category: true, amount: true },
  });

  // Serialize for client component
  const serializedTransactions = transactions.map((txn) => ({
    id: txn.id,
    amount: Number(txn.amount),
    date: txn.date.toISOString(),
    category: txn.category,
    merchantName: txn.merchantName,
    accountId: txn.account.id,
    accountName: txn.account.name,
  }));

  const serializedBudgets = budgets.map((b) => ({
    category: b.category,
    amount: Number(b.amount),
  }));

  return (
    <AnalyticsClient
      transactions={serializedTransactions}
      budgets={serializedBudgets}
    />
  );
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<AnalyticsSkeleton />}>
      <AnalyticsContent />
    </Suspense>
  );
}
