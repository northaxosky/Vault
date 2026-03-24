import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isDemoMode } from "@/lib/demo";

function seededCount(dateStr: string, isWeekend: boolean): number {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = ((hash << 5) - hash) + dateStr.charCodeAt(i);
    hash |= 0;
  }
  const max = isWeekend ? 3 : 8;
  return Math.abs(hash) % (max + 1);
}

export async function GET() {
  if (isDemoMode()) {
    const days = [];
    const now = new Date();
    for (let i = 89; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const count = seededCount(dateStr, isWeekend);
      days.push({ date: dateStr, count });
    }
    return NextResponse.json({ days });
  }

  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const ninetyDaysAgo = new Date(now);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 89);
    ninetyDaysAgo.setHours(0, 0, 0, 0);

    const transactions = await prisma.transaction.findMany({
      where: {
        account: { plaidItem: { userId: session.user.id } },
        date: { gte: ninetyDaysAgo },
      },
      select: { date: true },
    });

    const countMap = new Map<string, number>();
    for (const tx of transactions) {
      const dateStr = new Date(tx.date).toISOString().split("T")[0];
      countMap.set(dateStr, (countMap.get(dateStr) ?? 0) + 1);
    }

    const days = [];
    for (let i = 89; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      days.push({ date: dateStr, count: countMap.get(dateStr) ?? 0 });
    }

    return NextResponse.json({ days });
  } catch (error) {
    console.error("Error fetching activity heatmap:", error);
    return NextResponse.json(
      { error: "Failed to fetch activity data" },
      { status: 500 }
    );
  }
}
