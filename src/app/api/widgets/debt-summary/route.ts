import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isDemoMode } from "@/lib/demo";
import { DEMO_DEBTS } from "@/lib/demo-data";

export async function GET() {
  if (isDemoMode()) {
    const totalDebt = DEMO_DEBTS.reduce((sum, d) => sum + d.balance, 0);
    const totalMinPayment = DEMO_DEBTS.reduce((sum, d) => sum + d.minimumPayment, 0);
    const averageRate =
      totalDebt > 0
        ? Math.round(
            (DEMO_DEBTS.reduce((sum, d) => sum + d.balance * d.interestRate, 0) /
              totalDebt) *
              100,
          ) / 100
        : 0;
    return NextResponse.json({
      debts: DEMO_DEBTS,
      totalDebt,
      averageRate,
      totalMinPayment,
    });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const debts = await prisma.debtAccount.findMany({
    where: { userId: session.user.id },
    select: {
      name: true,
      balance: true,
      interestRate: true,
      minimumPayment: true,
    },
    orderBy: { balance: "desc" },
  });

  const items = debts.map((d) => ({
    name: d.name,
    balance: Number(d.balance),
    interestRate: Number(d.interestRate),
    minimumPayment: Number(d.minimumPayment),
  }));

  const totalDebt = items.reduce((sum, d) => sum + d.balance, 0);
  const totalMinPayment = items.reduce((sum, d) => sum + d.minimumPayment, 0);

  const averageRate =
    totalDebt > 0
      ? Math.round(
          (items.reduce((sum, d) => sum + d.balance * d.interestRate, 0) /
            totalDebt) *
            100,
        ) / 100
      : 0;

  return NextResponse.json({
    debts: items,
    totalDebt,
    averageRate,
    totalMinPayment,
  });
}
