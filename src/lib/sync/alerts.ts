import type { PrismaClient } from "@/generated/prisma/client";
import { sendAlertEmail } from "@/lib/email";
import type { PendingAlert } from "./types";

/**
 * Generate smart alerts after a sync: large transactions, low balances, budget overspend.
 *
 * Fixes N+1 patterns from the original:
 * - Batch-fetches existing alerts to build a dedup set (instead of one findFirst per check)
 * - Uses groupBy to compute per-category spending (instead of one aggregate per budget)
 */
export async function generateAlerts(
  prisma: PrismaClient,
  userId: string,
  totalAdded: number,
): Promise<void> {
  try {
    const userSettings = await prisma.userSettings.findUnique({
      where: { userId },
      select: { spendingAlert: true, lowBalanceAlert: true, emailAlerts: true },
    });

    if (!userSettings?.emailAlerts) return;

    // Batch-fetch all recent alerts for this user to avoid per-item existence checks
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingAlerts = await prisma.alert.findMany({
      where: {
        userId,
        createdAt: { gte: today },
      },
      select: { type: true, transactionId: true, message: true },
    });

    // Build dedup keys: "TYPE:identifier"
    const alertKeys = new Set<string>();
    for (const alert of existingAlerts) {
      if (alert.type === "LARGE_TRANSACTION" && alert.transactionId) {
        alertKeys.add(`LARGE_TRANSACTION:${alert.transactionId}`);
      } else if (alert.type === "LOW_BALANCE") {
        alertKeys.add(`LOW_BALANCE:${alert.message}`);
      } else if (alert.type === "BUDGET_OVERSPEND") {
        alertKeys.add(`BUDGET_OVERSPEND:${alert.message}`);
      }
    }

    const alertsToCreate: PendingAlert[] = [];

    // 1. LARGE_TRANSACTION
    if (userSettings.spendingAlert && totalAdded > 0) {
      const threshold = Number(userSettings.spendingAlert);
      const recentCutoff = new Date(Date.now() - 10 * 60 * 1000);
      const largeTransactions = await prisma.transaction.findMany({
        where: {
          account: { plaidItem: { userId } },
          amount: { gte: threshold },
          createdAt: { gte: recentCutoff },
        },
        select: { id: true, name: true, merchantName: true, amount: true, currency: true },
        take: 10,
      });

      for (const txn of largeTransactions) {
        if (alertKeys.has(`LARGE_TRANSACTION:${txn.id}`)) continue;
        const displayName = txn.merchantName || txn.name;
        alertsToCreate.push({
          userId,
          type: "LARGE_TRANSACTION",
          title: "Large transaction detected",
          message: `${displayName}: $${Number(txn.amount).toFixed(2)} ${txn.currency}`,
          transactionId: txn.id,
        });
      }
    }

    // 2. LOW_BALANCE
    if (userSettings.lowBalanceAlert) {
      const threshold = Number(userSettings.lowBalanceAlert);
      const lowAccounts = await prisma.account.findMany({
        where: {
          plaidItem: { userId },
          type: { in: ["depository"] },
          currentBalance: { lt: threshold },
        },
        select: { id: true, name: true, currentBalance: true, currency: true },
      });

      for (const acc of lowAccounts) {
        const message = `${acc.name} balance is $${Number(acc.currentBalance).toFixed(2)} ${acc.currency}`;
        if (alertKeys.has(`LOW_BALANCE:${message}`)) continue;
        alertsToCreate.push({
          userId,
          type: "LOW_BALANCE",
          title: "Low balance warning",
          message,
        });
      }
    }

    // 3. BUDGET_OVERSPEND — single groupBy instead of one aggregate per budget
    const budgets = await prisma.budget.findMany({
      where: { userId },
    });

    if (budgets.length > 0) {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      // Fetch all spending grouped by category in one query
      const spendingByCategory = await prisma.transaction.groupBy({
        by: ["category", "userCategory"],
        where: {
          account: { plaidItem: { userId } },
          date: { gte: monthStart },
          amount: { gt: 0 },
        },
        _sum: { amount: true },
      });

      // Build a map: category -> total spent
      // A transaction's effective category is userCategory ?? category
      const categoryTotals = new Map<string, number>();
      for (const row of spendingByCategory) {
        const effectiveCategory = row.userCategory ?? row.category;
        if (!effectiveCategory) continue;
        const current = categoryTotals.get(effectiveCategory) ?? 0;
        categoryTotals.set(effectiveCategory, current + Number(row._sum.amount ?? 0));
      }

      for (const budget of budgets) {
        const totalSpent = categoryTotals.get(budget.category) ?? 0;
        const limit = Number(budget.amount);

        if (totalSpent > limit) {
          const message = `${budget.category}: $${totalSpent.toFixed(2)} spent of $${limit.toFixed(2)} budget`;
          if (alertKeys.has(`BUDGET_OVERSPEND:${message}`)) continue;
          alertsToCreate.push({
            userId,
            type: "BUDGET_OVERSPEND",
            title: "Budget exceeded",
            message,
          });
        }
      }
    }

    // Batch create all alerts
    if (alertsToCreate.length > 0) {
      await prisma.alert.createMany({ data: alertsToCreate });

      // Send email notifications (non-blocking, best-effort)
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      if (user?.email) {
        for (const alert of alertsToCreate) {
          try {
            await sendAlertEmail(user.email, alert);
          } catch (emailError) {
            console.error("[email] Failed to send alert email:", emailError);
          }
        }
      }
    }
  } catch (error) {
    // Alert generation is non-critical
    console.error("Alert generation error:", error);
  }
}
