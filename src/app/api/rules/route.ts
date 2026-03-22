import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CATEGORY_CONFIG } from "@/lib/categories";

// --- Helpers ---

const VALID_MATCH_FIELDS = ["name", "merchantName"] as const;

function validateRule(body: Record<string, unknown>) {
  const { matchField, matchPattern, overrideName, overrideCategory } = body;

  if (!matchField || !VALID_MATCH_FIELDS.includes(matchField as typeof VALID_MATCH_FIELDS[number])) {
    return "matchField must be 'name' or 'merchantName'";
  }
  if (!matchPattern || typeof matchPattern !== "string" || matchPattern.trim().length === 0) {
    return "matchPattern is required";
  }
  if (
    overrideCategory !== undefined &&
    overrideCategory !== null &&
    overrideCategory !== "" &&
    !CATEGORY_CONFIG[overrideCategory as string]
  ) {
    return "Invalid overrideCategory";
  }
  if (!overrideName && !overrideCategory) {
    return "At least one of overrideName or overrideCategory is required";
  }
  return null;
}

/** Apply a single rule retroactively to all matching transactions for the user. */
async function applyRuleRetroactively(
  userId: string,
  matchField: string,
  matchPattern: string,
  overrideName: string | null,
  overrideCategory: string | null
) {
  // Build the where clause based on matchField
  const fieldFilter =
    matchField === "merchantName"
      ? { merchantName: { contains: matchPattern, mode: "insensitive" as const } }
      : { name: { contains: matchPattern, mode: "insensitive" as const } };

  const updateData: Record<string, unknown> = {};
  if (overrideName) updateData.name = overrideName;
  if (overrideCategory) updateData.userCategory = overrideCategory;

  await prisma.transaction.updateMany({
    where: {
      account: { plaidItem: { userId } },
      ...fieldFilter,
    },
    data: updateData,
  });
}

// --- GET: List all rules for the current user ---

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rules = await prisma.transactionRule.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ rules });
}

// --- POST: Create a new rule + apply retroactively ---

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const error = validateRule(body);
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    const { matchField, matchPattern, overrideName, overrideCategory } = body;

    const rule = await prisma.transactionRule.create({
      data: {
        userId: session.user.id,
        matchField,
        matchPattern: matchPattern.trim(),
        overrideName: overrideName?.trim() || null,
        overrideCategory: overrideCategory || null,
      },
    });

    // Apply retroactively to existing transactions
    await applyRuleRetroactively(
      session.user.id,
      matchField,
      matchPattern.trim(),
      overrideName?.trim() || null,
      overrideCategory || null
    );

    return NextResponse.json({ rule }, { status: 201 });
  } catch (err) {
    console.error("Error creating rule:", err);
    return NextResponse.json({ error: "Failed to create rule" }, { status: 500 });
  }
}

// --- PATCH: Update an existing rule + re-apply ---

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, matchField, matchPattern, overrideName, overrideCategory } = body;

    if (!id) {
      return NextResponse.json({ error: "Rule ID is required" }, { status: 400 });
    }

    const error = validateRule(body);
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    // Verify ownership
    const existing = await prisma.transactionRule.findUnique({ where: { id } });
    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    const rule = await prisma.transactionRule.update({
      where: { id },
      data: {
        matchField,
        matchPattern: matchPattern.trim(),
        overrideName: overrideName?.trim() || null,
        overrideCategory: overrideCategory || null,
      },
    });

    // Re-apply the updated rule retroactively
    await applyRuleRetroactively(
      session.user.id,
      matchField,
      matchPattern.trim(),
      overrideName?.trim() || null,
      overrideCategory || null
    );

    return NextResponse.json({ rule });
  } catch (err) {
    console.error("Error updating rule:", err);
    return NextResponse.json({ error: "Failed to update rule" }, { status: 500 });
  }
}

// --- DELETE: Remove a rule (does NOT undo past applications) ---

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "Rule ID is required" }, { status: 400 });
    }

    // Verify ownership
    const existing = await prisma.transactionRule.findUnique({ where: { id } });
    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    await prisma.transactionRule.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error deleting rule:", err);
    return NextResponse.json({ error: "Failed to delete rule" }, { status: 500 });
  }
}
