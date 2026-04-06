import { NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmailChangeVerification } from "@/lib/email";
import { unauthorizedResponse, validationError, errorResponse } from "@/lib/api-response";

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return unauthorizedResponse();
  }

  try {
    const { newEmail, password } = await request.json();

    if (!newEmail || !password) {
      return validationError("New email and password are required");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      return validationError("Invalid email address");
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true, passwordHash: true },
    });

    if (!user?.passwordHash) {
      return validationError("Password verification not available for this account");
    }

    if (newEmail.toLowerCase() === user.email.toLowerCase()) {
      return validationError("New email must be different from current email");
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return errorResponse("Password is incorrect", 401);
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: newEmail.toLowerCase() },
    });

    if (existingUser) {
      return errorResponse("Email is already in use", 409);
    }

    // Clean up any existing tokens for this user
    await prisma.emailChangeToken.deleteMany({
      where: { userId: session.user.id },
    });

    const token = crypto.randomUUID();
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.emailChangeToken.create({
      data: {
        userId: session.user.id,
        newEmail: newEmail.toLowerCase(),
        token,
        expires,
      },
    });

    await sendEmailChangeVerification(newEmail, token);

    return NextResponse.json({
      message: "Verification email sent to new address",
    });
  } catch (error) {
    console.error("Error requesting email change:", error);
    return errorResponse("Failed to process email change request", 500);
  }
}
