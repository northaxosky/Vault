import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isDemoMode } from "@/lib/demo";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ batchId: string }> },
) {
  if (isDemoMode()) {
    return NextResponse.json(
      { error: "Cannot delete imports in demo mode" },
      { status: 403 },
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { batchId } = await params;

    // Verify the batch exists and belongs to this user
    const owned = await prisma.transaction.findFirst({
      where: {
        importBatchId: batchId,
        account: { plaidItem: { userId: session.user.id } },
      },
      select: { id: true },
    });

    if (!owned) {
      return NextResponse.json(
        { error: "Import batch not found" },
        { status: 404 },
      );
    }

    // Delete all transactions in this batch that belong to the user
    const result = await prisma.transaction.deleteMany({
      where: {
        importBatchId: batchId,
        account: { plaidItem: { userId: session.user.id } },
      },
    });

    return NextResponse.json({
      success: true,
      deleted: result.count,
    });
  } catch (error) {
    console.error("Error deleting import batch:", error);
    return NextResponse.json(
      { error: "Failed to delete import batch" },
      { status: 500 },
    );
  }
}
