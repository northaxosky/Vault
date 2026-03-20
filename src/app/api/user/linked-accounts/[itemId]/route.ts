import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// --- DELETE: Unlink a specific bank connection ---
// Cascade deletes will remove all associated accounts, transactions, and holdings.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { itemId } = await params;

    // Verify the PlaidItem belongs to this user
    const plaidItem = await prisma.plaidItem.findUnique({
      where: { id: itemId },
      select: { userId: true, institutionName: true },
    });

    if (!plaidItem) {
      return NextResponse.json(
        { error: "Linked account not found" },
        { status: 404 }
      );
    }

    if (plaidItem.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
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
    return NextResponse.json(
      { error: "Failed to unlink account" },
      { status: 500 }
    );
  }
}
