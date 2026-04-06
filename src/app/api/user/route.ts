import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isDemoMode } from "@/lib/demo";
import { unauthorizedResponse, validationError, errorResponse, successResponse } from "@/lib/api-response";

// --- DELETE: Delete user account ---
// Requires password confirmation. Cascade deletes handle all related data.
export async function DELETE(request: Request) {
  if (isDemoMode()) {
    return errorResponse("Account deletion is not available in demo mode", 403);
  }

  const session = await auth();

  if (!session?.user?.id) {
    return unauthorizedResponse();
  }

  try {
    const { password } = await request.json();

    if (!password) {
      return validationError("Password is required to delete your account");
    }

    // Verify the password
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { passwordHash: true },
    });

    if (!user?.passwordHash) {
      return validationError("Cannot verify identity");
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);

    if (!isValid) {
      return validationError("Incorrect password");
    }

    // Delete the user — cascade deletes handle PlaidItems, Accounts,
    // Transactions, Holdings, and UserSettings automatically
    await prisma.user.delete({
      where: { id: session.user.id },
    });

    return successResponse({ success: true });
  } catch (error) {
    console.error("Error deleting account:", error);
    return errorResponse("Failed to delete account", 500);
  }
}
