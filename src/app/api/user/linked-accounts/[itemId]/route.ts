import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { unauthorizedResponse, notFoundResponse, errorResponse } from "@/lib/api-response";

// --- DELETE: Unlink a specific bank connection ---
// Cascade deletes will remove all associated accounts, transactions, and holdings.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return unauthorizedResponse();
  }

  try {
    const { itemId } = await params;

    // Verify the PlaidItem belongs to this user
    const plaidItem = await prisma.plaidItem.findUnique({
      where: { id: itemId },
      select: { userId: true, institutionName: true },
    });

    if (!plaidItem) {
      return notFoundResponse("Linked account");
    }

    if (plaidItem.userId !== session.user.id) {
      return errorResponse("Unauthorized", 403);
    }

    // Delete the PlaidItem — cascade deletes handle accounts,
    // transactions, and holdings automatically
    await prisma.plaidItem.delete({
      where: { id: itemId },
    });

    return NextResponse.json({
      success: true,
      message: `Unlinked ${plaidItem.institutionName || "account"}`,
    });
  } catch (error) {
    console.error("Error unlinking account:", error);
    return errorResponse("Failed to unlink account", 500);
  }
}
