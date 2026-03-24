import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
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
