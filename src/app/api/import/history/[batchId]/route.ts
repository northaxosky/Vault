import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isDemoMode } from "@/lib/demo";
import { unauthorizedResponse, notFoundResponse, errorResponse, successResponse } from "@/lib/api-response";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ batchId: string }> },
) {
  if (isDemoMode()) {
    return errorResponse("Cannot delete imports in demo mode", 403);
  }

  const session = await auth();
  if (!session?.user?.id) {
    return unauthorizedResponse();
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
      return notFoundResponse("Import batch");
    }

    // Delete all transactions in this batch that belong to the user
    const result = await prisma.transaction.deleteMany({
      where: {
        importBatchId: batchId,
        account: { plaidItem: { userId: session.user.id } },
      },
    });

    return successResponse({ success: true, deleted: result.count });
  } catch (error) {
    console.error("Error deleting import batch:", error);
    return errorResponse("Failed to delete import batch", 500);
  }
}
