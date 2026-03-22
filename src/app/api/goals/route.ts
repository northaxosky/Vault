import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// --- GET: Fetch all savings goals for the current user ---
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const goals = await prisma.savingsGoal.findMany({
      where: { userId: session.user.id },
      include: { linkedAccount: { select: { name: true, currentBalance: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      goals: goals.map((g) => ({
        id: g.id,
        name: g.name,
        targetAmount: Number(g.targetAmount),
        currentAmount: Number(g.currentAmount),
        deadline: g.deadline?.toISOString() ?? null,
        linkedAccountId: g.linkedAccountId,
        linkedAccountName: g.linkedAccount?.name ?? null,
        linkedAccountBalance: g.linkedAccount?.currentBalance != null
          ? Number(g.linkedAccount.currentBalance)
          : null,
      })),
    });
  } catch (error) {
    console.error("Error fetching goals:", error);
    return NextResponse.json({ error: "Failed to fetch goals" }, { status: 500 });
  }
}

// --- POST: Create a new savings goal ---
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, targetAmount, deadline, linkedAccountId } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const numTarget = Number(targetAmount);
    if (isNaN(numTarget) || numTarget <= 0) {
      return NextResponse.json({ error: "Target amount must be positive" }, { status: 400 });
    }

    // Validate linked account ownership if provided
    if (linkedAccountId) {
      const account = await prisma.account.findFirst({
        where: { id: linkedAccountId, plaidItem: { userId: session.user.id } },
      });
      if (!account) {
        return NextResponse.json({ error: "Account not found" }, { status: 404 });
      }
    }

    const goal = await prisma.savingsGoal.create({
      data: {
        userId: session.user.id,
        name,
        targetAmount: numTarget,
        deadline: deadline ? new Date(deadline) : null,
        linkedAccountId: linkedAccountId || null,
      },
    });

    return NextResponse.json({
      goal: {
        id: goal.id,
        name: goal.name,
        targetAmount: Number(goal.targetAmount),
        currentAmount: Number(goal.currentAmount),
        deadline: goal.deadline?.toISOString() ?? null,
        linkedAccountId: goal.linkedAccountId,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating goal:", error);
    return NextResponse.json({ error: "Failed to create goal" }, { status: 500 });
  }
}

// --- PATCH: Update a savings goal ---
export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, name, targetAmount, currentAmount, deadline, linkedAccountId } = body;

    if (!id) {
      return NextResponse.json({ error: "Goal ID is required" }, { status: 400 });
    }

    const existing = await prisma.savingsGoal.findUnique({ where: { id } });
    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (targetAmount !== undefined) {
      const num = Number(targetAmount);
      if (isNaN(num) || num <= 0) {
        return NextResponse.json({ error: "Target amount must be positive" }, { status: 400 });
      }
      data.targetAmount = num;
    }
    if (currentAmount !== undefined) {
      const num = Number(currentAmount);
      if (isNaN(num) || num < 0) {
        return NextResponse.json({ error: "Current amount must be non-negative" }, { status: 400 });
      }
      data.currentAmount = num;
    }
    if (deadline !== undefined) data.deadline = deadline ? new Date(deadline) : null;
    if (linkedAccountId !== undefined) data.linkedAccountId = linkedAccountId || null;

    const updated = await prisma.savingsGoal.update({ where: { id }, data });

    return NextResponse.json({
      goal: {
        id: updated.id,
        name: updated.name,
        targetAmount: Number(updated.targetAmount),
        currentAmount: Number(updated.currentAmount),
        deadline: updated.deadline?.toISOString() ?? null,
        linkedAccountId: updated.linkedAccountId,
      },
    });
  } catch (error) {
    console.error("Error updating goal:", error);
    return NextResponse.json({ error: "Failed to update goal" }, { status: 500 });
  }
}

// --- DELETE: Remove a savings goal ---
export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "Goal ID is required" }, { status: 400 });
    }

    const existing = await prisma.savingsGoal.findUnique({ where: { id } });
    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }

    await prisma.savingsGoal.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting goal:", error);
    return NextResponse.json({ error: "Failed to delete goal" }, { status: 500 });
  }
}
