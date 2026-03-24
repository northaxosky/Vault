import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateCreditScore } from "@/lib/credit-score";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accounts = await prisma.account.findMany({
    where: { plaidItem: { userId: session.user.id } },
    select: {
      type: true,
      currentBalance: true,
      availableBalance: true,
      createdAt: true,
    },
  });

  const recurringStreams = await prisma.recurringStream.findMany({
    where: { account: { plaidItem: { userId: session.user.id } } },
    select: { isActive: true, cancelledByUser: true },
  });

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const transactionCount = await prisma.transaction.count({
    where: {
      account: { plaidItem: { userId: session.user.id } },
      date: { gte: thirtyDaysAgo },
    },
  });

  const input = {
    totalRecurringStreams: recurringStreams.length,
    activeRecurringStreams: recurringStreams.filter(
      (s) => s.isActive && !s.cancelledByUser,
    ).length,
    creditAccounts: accounts
      .filter((a) => a.type === "credit")
      .map((a) => ({
        currentBalance: Number(a.currentBalance ?? 0),
        availableBalance: a.availableBalance
          ? Number(a.availableBalance)
          : null,
      })),
    accountCreatedDates: accounts.map((a) => a.createdAt),
    accountTypes: accounts.map((a) => a.type),
    transactionCountLast30Days: transactionCount,
  };

  const result = calculateCreditScore(input);
  return NextResponse.json(result);
}
