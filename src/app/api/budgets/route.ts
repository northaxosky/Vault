import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CATEGORY_CONFIG } from "@/lib/categories";

// --- GET: Fetch all budgets for the current user ---
export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const budgets = await prisma.budget.findMany({
      where: { userId: session.user.id },
      orderBy: { category: "asc" },
    });

    return NextResponse.json({
      budgets: budgets.map((b) => ({
        id: b.id,
        category: b.category,
        amount: Number(b.amount),
      })),
    });
  } catch (error) {
    console.error("Error fetching budgets:", error);
    return NextResponse.json(
      { error: "Failed to fetch budgets" },
      { status: 500 }
    );
  }
}

// --- POST: Create a new budget ---
export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { category, amount } = body;

    // Validate category is a known Plaid category
    if (!category || !CATEGORY_CONFIG[category]) {
      return NextResponse.json(
        { error: "Invalid category" },
        { status: 400 }
      );
    }

    // Validate amount is a positive number
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json(
        { error: "Amount must be a positive number" },
        { status: 400 }
      );
    }

    const budget = await prisma.budget.create({
      data: {
        userId: session.user.id,
        category,
        amount: numAmount,
      },
    });

    return NextResponse.json(
      {
        budget: {
          id: budget.id,
          category: budget.category,
          amount: Number(budget.amount),
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    // Handle unique constraint violation (budget already exists for this category)
    if (
      error instanceof Error &&
      error.message.includes("Unique constraint")
    ) {
      return NextResponse.json(
        { error: "A budget already exists for this category" },
        { status: 409 }
      );
    }
    console.error("Error creating budget:", error);
    return NextResponse.json(
      { error: "Failed to create budget" },
      { status: 500 }
    );
  }
}

// --- PATCH: Update an existing budget's amount ---
export async function PATCH(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, amount } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Budget ID is required" },
        { status: 400 }
      );
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json(
        { error: "Amount must be a positive number" },
        { status: 400 }
      );
    }

    // Verify ownership before updating
    const existing = await prisma.budget.findUnique({ where: { id } });
    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Budget not found" },
        { status: 404 }
      );
    }

    const budget = await prisma.budget.update({
      where: { id },
      data: { amount: numAmount },
    });

    return NextResponse.json({
      budget: {
        id: budget.id,
        category: budget.category,
        amount: Number(budget.amount),
      },
    });
  } catch (error) {
    console.error("Error updating budget:", error);
    return NextResponse.json(
      { error: "Failed to update budget" },
      { status: 500 }
    );
  }
}

// --- DELETE: Remove a budget ---
export async function DELETE(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Budget ID is required" },
        { status: 400 }
      );
    }

    // Verify ownership before deleting
    const existing = await prisma.budget.findUnique({ where: { id } });
    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Budget not found" },
        { status: 404 }
      );
    }

    await prisma.budget.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting budget:", error);
    return NextResponse.json(
      { error: "Failed to delete budget" },
      { status: 500 }
    );
  }
}
