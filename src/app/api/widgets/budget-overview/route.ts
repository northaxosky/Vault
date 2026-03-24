import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCategoryLabel } from "@/lib/categories";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const budgets = await prisma.budget.findMany({
      where: { userId: session.user.id },
    });

    if (budgets.length === 0) {
      return NextResponse.json({ budgets: [] });
    }

    const categories = budgets.map((b) => b.category);

    const transactions = await prisma.transaction.findMany({
      where: {
        account: { plaidItem: { userId: session.user.id } },
        date: { gte: startOfMonth },
        amount: { gt: 0 },
        OR: [
          { userCategory: { in: categories } },
          { userCategory: null, category: { in: categories } },
        ],
      },
      select: { amount: true, category: true, userCategory: true },
    });

    const spendingMap = new Map<string, number>();
    for (const tx of transactions) {
      const effectiveCategory = tx.userCategory ?? tx.category;
      if (effectiveCategory && categories.includes(effectiveCategory)) {
        spendingMap.set(
          effectiveCategory,
          (spendingMap.get(effectiveCategory) ?? 0) + Number(tx.amount)
        );
      }
    }

    const result = budgets
      .map((b) => {
        const spent = spendingMap.get(b.category) ?? 0;
        const limit = Number(b.amount);
        const percentage = Math.round((spent / limit) * 100);
        return {
          category: b.category,
          label: getCategoryLabel(b.category),
          spent,
          limit,
          percentage,
        };
      })
      .sort((a, b) => b.percentage - a.percentage);

    return NextResponse.json({ budgets: result });
  } catch (error) {
    console.error("Error fetching budget overview:", error);
    return NextResponse.json(
      { error: "Failed to fetch budget overview" },
      { status: 500 }
    );
  }
}
