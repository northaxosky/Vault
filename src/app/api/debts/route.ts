import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// --- GET: Fetch all debt accounts for the current user ---
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const debts = await prisma.debtAccount.findMany({
      where: { userId: session.user.id },
      include: { linkedAccount: { select: { name: true, currentBalance: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      debts: debts.map((d) => ({
        id: d.id,
        name: d.name,
        balance: Number(d.balance),
        interestRate: Number(d.interestRate),
        minimumPayment: Number(d.minimumPayment),
        linkedAccountId: d.linkedAccountId,
        linkedAccountName: d.linkedAccount?.name ?? null,
      })),
    });
  } catch (error) {
    console.error("Error fetching debts:", error);
    return NextResponse.json({ error: "Failed to fetch debts" }, { status: 500 });
  }
}

// --- POST: Create a new debt account ---
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, balance, interestRate, minimumPayment, linkedAccountId } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const numBalance = Number(balance);
    if (isNaN(numBalance) || numBalance <= 0) {
      return NextResponse.json({ error: "Balance must be positive" }, { status: 400 });
    }

    const numRate = Number(interestRate);
    if (isNaN(numRate) || numRate < 0 || numRate > 100) {
      return NextResponse.json({ error: "Interest rate must be between 0 and 100" }, { status: 400 });
    }

    const numMinPayment = Number(minimumPayment);
    if (isNaN(numMinPayment) || numMinPayment <= 0) {
      return NextResponse.json({ error: "Minimum payment must be positive" }, { status: 400 });
    }

    if (linkedAccountId) {
      const account = await prisma.account.findFirst({
        where: { id: linkedAccountId, plaidItem: { userId: session.user.id } },
      });
      if (!account) {
        return NextResponse.json({ error: "Account not found" }, { status: 404 });
      }
    }

    const debt = await prisma.debtAccount.create({
      data: {
        userId: session.user.id,
        name,
        balance: numBalance,
        interestRate: numRate,
        minimumPayment: numMinPayment,
        linkedAccountId: linkedAccountId || null,
      },
    });

    return NextResponse.json({
      debt: {
        id: debt.id,
        name: debt.name,
        balance: Number(debt.balance),
        interestRate: Number(debt.interestRate),
        minimumPayment: Number(debt.minimumPayment),
        linkedAccountId: debt.linkedAccountId,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating debt:", error);
    return NextResponse.json({ error: "Failed to create debt" }, { status: 500 });
  }
}

// --- PATCH: Update a debt account ---
export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, name, balance, interestRate, minimumPayment, linkedAccountId } = body;

    if (!id) {
      return NextResponse.json({ error: "Debt ID is required" }, { status: 400 });
    }

    const existing = await prisma.debtAccount.findUnique({ where: { id } });
    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Debt not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (balance !== undefined) {
      const num = Number(balance);
      if (isNaN(num) || num <= 0) {
        return NextResponse.json({ error: "Balance must be positive" }, { status: 400 });
      }
      data.balance = num;
    }
    if (interestRate !== undefined) {
      const num = Number(interestRate);
      if (isNaN(num) || num < 0 || num > 100) {
        return NextResponse.json({ error: "Interest rate must be between 0 and 100" }, { status: 400 });
      }
      data.interestRate = num;
    }
    if (minimumPayment !== undefined) {
      const num = Number(minimumPayment);
      if (isNaN(num) || num <= 0) {
        return NextResponse.json({ error: "Minimum payment must be positive" }, { status: 400 });
      }
      data.minimumPayment = num;
    }
    if (linkedAccountId !== undefined) data.linkedAccountId = linkedAccountId || null;

    const updated = await prisma.debtAccount.update({ where: { id }, data });

    return NextResponse.json({
      debt: {
        id: updated.id,
        name: updated.name,
        balance: Number(updated.balance),
        interestRate: Number(updated.interestRate),
        minimumPayment: Number(updated.minimumPayment),
        linkedAccountId: updated.linkedAccountId,
      },
    });
  } catch (error) {
    console.error("Error updating debt:", error);
    return NextResponse.json({ error: "Failed to update debt" }, { status: 500 });
  }
}

// --- DELETE: Remove a debt account ---
export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "Debt ID is required" }, { status: 400 });
    }

    const existing = await prisma.debtAccount.findUnique({ where: { id } });
    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Debt not found" }, { status: 404 });
    }

    await prisma.debtAccount.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting debt:", error);
    return NextResponse.json({ error: "Failed to delete debt" }, { status: 500 });
  }
}
