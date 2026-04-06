import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isDemoMode } from "@/lib/demo";
import { unauthorizedResponse, validationError, errorResponse } from "@/lib/api-response";

// --- PATCH: Update user profile (name) ---
export async function PATCH(request: Request) {
  if (isDemoMode()) {
    return NextResponse.json({ user: { id: "demo", name: "Demo User", email: "demo@vault.dev" } });
  }

  const session = await auth();

  if (!session?.user?.id) {
    return unauthorizedResponse();
  }

  try {
    const { name } = await request.json();

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return validationError("Name is required");
    }

    // Capitalize each word, same logic as the register route
    const formattedName = name
      .trim()
      .replace(/\b\w/g, (c: string) => c.toUpperCase());

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: { name: formattedName },
      select: { id: true, name: true, email: true },
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Error updating profile:", error);
    return errorResponse("Failed to update profile", 500);
  }
}
