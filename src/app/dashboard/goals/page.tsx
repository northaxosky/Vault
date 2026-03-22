import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import GoalsClient from "@/components/GoalsClient";

export default async function GoalsPage() {
  const session = await auth();

  // --- Savings Goals ---
  const rawGoals = await prisma.savingsGoal.findMany({
    where: { userId: session!.user.id },
    include: {
      linkedAccount: { select: { name: true, currentBalance: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Auto-sync: if a goal has a linked account, update currentAmount from account balance
  for (const goal of rawGoals) {
    if (goal.linkedAccount && goal.linkedAccount.currentBalance != null) {
      const linkedBalance = Number(goal.linkedAccount.currentBalance);
      if (linkedBalance !== Number(goal.currentAmount)) {
        await prisma.savingsGoal.update({
          where: { id: goal.id },
          data: { currentAmount: linkedBalance },
        });
        goal.currentAmount = goal.linkedAccount.currentBalance;
      }
    }
  }

  const goals = rawGoals.map((g) => ({
    id: g.id,
    name: g.name,
    targetAmount: Number(g.targetAmount),
    currentAmount: Number(g.currentAmount),
    deadline: g.deadline?.toISOString() ?? null,
    linkedAccountId: g.linkedAccountId,
    linkedAccountName: g.linkedAccount?.name ?? null,
  }));

  // --- Debt Accounts ---
  const rawDebts = await prisma.debtAccount.findMany({
    where: { userId: session!.user.id },
    include: {
      linkedAccount: { select: { name: true, currentBalance: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Auto-sync: if a debt has a linked account, update balance from account balance
  for (const debt of rawDebts) {
    if (debt.linkedAccount && debt.linkedAccount.currentBalance != null) {
      const linkedBalance = Number(debt.linkedAccount.currentBalance);
      if (linkedBalance !== Number(debt.balance)) {
        await prisma.debtAccount.update({
          where: { id: debt.id },
          data: { balance: linkedBalance },
        });
        debt.balance = debt.linkedAccount.currentBalance;
      }
    }
  }

  const debts = rawDebts.map((d) => ({
    id: d.id,
    name: d.name,
    balance: Number(d.balance),
    interestRate: Number(d.interestRate),
    minimumPayment: Number(d.minimumPayment),
    linkedAccountId: d.linkedAccountId,
    linkedAccountName: d.linkedAccount?.name ?? null,
  }));

  // --- Cash Flow Forecast data ---
  // Current total balance across all accounts (credit subtracted)
  const allAccounts = await prisma.account.findMany({
    where: { plaidItem: { userId: session!.user.id } },
    select: { id: true, name: true, type: true, currentBalance: true },
  });

  let currentBalance = 0;
  for (const acct of allAccounts) {
    const bal = Number(acct.currentBalance ?? 0);
    if (acct.type === "credit") {
      currentBalance -= bal;
    } else {
      currentBalance += bal;
    }
  }

  // Active recurring streams for projection
  const rawStreams = await prisma.recurringStream.findMany({
    where: {
      account: { plaidItem: { userId: session!.user.id } },
      isActive: true,
      cancelledByUser: false,
    },
    select: {
      averageAmount: true,
      frequency: true,
      predictedNextDate: true,
      streamType: true,
      merchantName: true,
      description: true,
      currency: true,
    },
  });

  const streams = rawStreams.map((s) => ({
    averageAmount: Number(s.averageAmount),
    frequency: s.frequency,
    predictedNextDate: s.predictedNextDate?.toISOString() ?? null,
    streamType: s.streamType,
    merchantName: s.merchantName,
    description: s.description,
    currency: s.currency,
  }));

  // User's accounts for the "Link to account" dropdowns
  const accounts = allAccounts.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
  }));

  return (
    <GoalsClient
      goals={goals}
      debts={debts}
      currentBalance={currentBalance}
      recurringStreams={streams}
      accounts={accounts}
    />
  );
}
