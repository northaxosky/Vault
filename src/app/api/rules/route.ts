import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CATEGORY_CONFIG } from "@/lib/categories";
import { unauthorizedResponse, notFoundResponse, validationError, errorResponse, successResponse } from "@/lib/api-response";

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
    return unauthorizedResponse();
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
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();
    const error = validateRule(body);
    if (error) {
      return validationError(error);
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
    return errorResponse("Failed to create rule", 500);
  }
}

// --- PATCH: Update an existing rule + re-apply ---

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();
    const { id, matchField, matchPattern, overrideName, overrideCategory } = body;

    if (!id) {
      return validationError("Rule ID is required");
    }

    const error = validateRule(body);
    if (error) {
      return validationError(error);
    }

    // Verify ownership
    const existing = await prisma.transactionRule.findUnique({ where: { id } });
    if (!existing || existing.userId !== session.user.id) {
      return notFoundResponse("Rule");
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
    return errorResponse("Failed to update rule", 500);
  }
}

// --- DELETE: Remove a rule (does NOT undo past applications) ---

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return unauthorizedResponse();
  }

  try {
    const { id } = await request.json();

    if (!id) {
      return validationError("Rule ID is required");
    }

    // Verify ownership
    const existing = await prisma.transactionRule.findUnique({ where: { id } });
    if (!existing || existing.userId !== session.user.id) {
      return notFoundResponse("Rule");
    }

    await prisma.transactionRule.delete({ where: { id } });

    return successResponse({ success: true });
  } catch (err) {
    console.error("Error deleting rule:", err);
    return errorResponse("Failed to delete rule", 500);
  }
}
