import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();

  if (!query || query.length < 2) {
    return NextResponse.json({ transactions: [], accounts: [] });
  }

  try {
    const rawTransactions = await prisma.transaction.findMany({
      where: {
        account: { plaidItem: { userId: session.user.id } },
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { merchantName: { contains: query, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        name: true,
        merchantName: true,
        amount: true,
        date: true,
        category: true,
        currency: true,
        account: { select: { name: true } },
      },
      orderBy: { date: "desc" },
      take: 5,
    });

    const rawAccounts = await prisma.account.findMany({
      where: {
        plaidItem: { userId: session.user.id },
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { officialName: { contains: query, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        name: true,
        officialName: true,
        type: true,
        currentBalance: true,
        currency: true,
      },
      take: 5,
    });

    return NextResponse.json({
      transactions: rawTransactions.map((t) => ({
        id: t.id,
        name: t.name,
        merchantName: t.merchantName,
        amount: Number(t.amount),
        date: t.date.toISOString(),
        category: t.category,
        currency: t.currency,
        accountName: t.account.name,
      })),
      accounts: rawAccounts.map((a) => ({
        id: a.id,
        name: a.name,
        officialName: a.officialName,
        type: a.type,
        currentBalance: a.currentBalance != null ? Number(a.currentBalance) : null,
        currency: a.currency,
      })),
    });
  } catch (error) {
    console.error("Error searching:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
