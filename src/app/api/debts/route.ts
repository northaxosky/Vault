import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { unauthorizedResponse, notFoundResponse, validationError, errorResponse, successResponse } from "@/lib/api-response";

// --- GET: Fetch all debt accounts for the current user ---
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return unauthorizedResponse();
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
    return errorResponse("Failed to fetch debts", 500);
  }
}

// --- POST: Create a new debt account ---
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();
    const { name, balance, interestRate, minimumPayment, linkedAccountId } = body;

    if (!name || typeof name !== "string") {
      return validationError("Name is required");
    }

    const numBalance = Number(balance);
    if (isNaN(numBalance) || numBalance <= 0) {
      return validationError("Balance must be positive");
    }

    const numRate = Number(interestRate);
    if (isNaN(numRate) || numRate < 0 || numRate > 100) {
      return validationError("Interest rate must be between 0 and 100");
    }

    const numMinPayment = Number(minimumPayment);
    if (isNaN(numMinPayment) || numMinPayment <= 0) {
      return validationError("Minimum payment must be positive");
    }

    if (linkedAccountId) {
      const account = await prisma.account.findFirst({
        where: { id: linkedAccountId, plaidItem: { userId: session.user.id } },
      });
      if (!account) {
        return notFoundResponse("Account");
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
    return errorResponse("Failed to create debt", 500);
  }
}

// --- PATCH: Update a debt account ---
export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();
    const { id, name, balance, interestRate, minimumPayment, linkedAccountId } = body;

    if (!id) {
      return validationError("Debt ID is required");
    }

    const existing = await prisma.debtAccount.findUnique({ where: { id } });
    if (!existing || existing.userId !== session.user.id) {
      return notFoundResponse("Debt");
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (balance !== undefined) {
      const num = Number(balance);
      if (isNaN(num) || num <= 0) {
        return validationError("Balance must be positive");
      }
      data.balance = num;
    }
    if (interestRate !== undefined) {
      const num = Number(interestRate);
      if (isNaN(num) || num < 0 || num > 100) {
        return validationError("Interest rate must be between 0 and 100");
      }
      data.interestRate = num;
    }
    if (minimumPayment !== undefined) {
      const num = Number(minimumPayment);
      if (isNaN(num) || num <= 0) {
        return validationError("Minimum payment must be positive");
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
    return errorResponse("Failed to update debt", 500);
  }
}

// --- DELETE: Remove a debt account ---
export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return validationError("Debt ID is required");
    }

    const existing = await prisma.debtAccount.findUnique({ where: { id } });
    if (!existing || existing.userId !== session.user.id) {
      return notFoundResponse("Debt");
    }

    await prisma.debtAccount.delete({ where: { id } });
    return successResponse({ success: true });
  } catch (error) {
    console.error("Error deleting debt:", error);
    return errorResponse("Failed to delete debt", 500);
  }
}
