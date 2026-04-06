import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CATEGORY_CONFIG } from "@/lib/categories";
import { isDemoMode } from "@/lib/demo";
import { unauthorizedResponse, notFoundResponse, validationError, errorResponse, successResponse } from "@/lib/api-response";

export async function PATCH(request: Request) {
  if (isDemoMode()) {
    return successResponse({ success: true });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();
    const { id, notes, userCategory } = body;

    if (!id) {
      return validationError("Transaction ID is required");
    }

    // Validate userCategory if provided
    if (
      userCategory !== undefined &&
      userCategory !== null &&
      userCategory !== "" &&
      !CATEGORY_CONFIG[userCategory]
    ) {
      return validationError("Invalid category");
    }

    // Verify ownership: transaction → account → plaidItem → userId
    const transaction = await prisma.transaction.findUnique({
      where: { id },
      select: {
        account: {
          select: { plaidItem: { select: { userId: true } } },
        },
      },
    });

    if (
      !transaction ||
      transaction.account.plaidItem.userId !== session.user.id
    ) {
      return notFoundResponse("Transaction");
    }

    // Build update — only include fields that were sent
    const updateData: Record<string, unknown> = {};
    if (notes !== undefined) updateData.notes = notes || null;
    if (userCategory !== undefined)
      updateData.userCategory = userCategory || null;

    const updated = await prisma.transaction.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      transaction: {
        id: updated.id,
        notes: updated.notes,
        userCategory: updated.userCategory,
      },
    });
  } catch (error) {
    console.error("Error updating transaction:", error);
    return errorResponse("Failed to update transaction", 500);
  }
}
