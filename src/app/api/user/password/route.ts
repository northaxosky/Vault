import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validatePassword, BCRYPT_ROUNDS } from "@/lib/validation";
import { unauthorizedResponse, validationError, errorResponse, successResponse } from "@/lib/api-response";

// --- PATCH: Change password ---
export async function PATCH(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return unauthorizedResponse();
  }

  try {
    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return validationError("Current and new passwords are required");
    }

    const passwordCheck = validatePassword(newPassword);
    if (!passwordCheck.valid) {
      return validationError(passwordCheck.message);
    }

    // Fetch the user's current password hash
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { passwordHash: true },
    });

    if (!user?.passwordHash) {
      return validationError("Password change not available for this account");
    }

    // Verify the current password
    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);

    if (!isValid) {
      return validationError("Current password is incorrect");
    }

    // Hash the new password
    const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await prisma.user.update({
      where: { id: session.user.id },
      data: { passwordHash: newHash },
    });

    return successResponse({ success: true });
  } catch (error) {
    console.error("Error changing password:", error);
    return errorResponse("Failed to change password", 500);
  }
}
