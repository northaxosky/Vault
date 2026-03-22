import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CATEGORY_CONFIG } from "@/lib/categories";

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, notes, userCategory } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Transaction ID is required" },
        { status: 400 }
      );
    }

    // Validate userCategory if provided
    if (
      userCategory !== undefined &&
      userCategory !== null &&
      userCategory !== "" &&
      !CATEGORY_CONFIG[userCategory]
    ) {
      return NextResponse.json(
        { error: "Invalid category" },
        { status: 400 }
      );
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
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
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
    return NextResponse.json(
      { error: "Failed to update transaction" },
      { status: 500 }
    );
  }
}
