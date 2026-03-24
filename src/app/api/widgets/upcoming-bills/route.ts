import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isDemoMode } from "@/lib/demo";
import { DEMO_RECURRING } from "@/lib/demo-data";

export async function GET() {
  if (isDemoMode()) {
    return NextResponse.json({ bills: DEMO_RECURRING });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const twoWeeksFromNow = new Date();
  twoWeeksFromNow.setDate(now.getDate() + 14);

  const streams = await prisma.recurringStream.findMany({
    where: {
      account: { plaidItem: { userId: session.user.id } },
      isActive: true,
      cancelledByUser: false,
      predictedNextDate: {
        not: null,
        gte: now,
        lte: twoWeeksFromNow,
      },
    },
    select: {
      merchantName: true,
      description: true,
      lastAmount: true,
      predictedNextDate: true,
      frequency: true,
    },
    orderBy: { predictedNextDate: "asc" },
  });

  const bills = streams.map((s) => ({
    name: s.merchantName ?? s.description,
    amount: Number(s.lastAmount),
    date: s.predictedNextDate!.toISOString(),
    frequency: s.frequency,
  }));

  return NextResponse.json({ bills });
}
