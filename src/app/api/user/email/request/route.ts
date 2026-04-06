import { NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmailChangeVerification } from "@/lib/email";

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { newEmail, password } = await request.json();

    if (!newEmail || !password) {
      return NextResponse.json(
        { error: "New email and password are required" },
        { status: 400 },
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(newEmail)) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true, passwordHash: true },
    });

    if (!user?.passwordHash) {
      return NextResponse.json(
        { error: "Password verification not available for this account" },
        { status: 400 },
      );
    }

    if (newEmail.toLowerCase() === user.email.toLowerCase()) {
      return NextResponse.json(
        { error: "New email must be different from current email" },
        { status: 400 },
      );
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: "Password is incorrect" },
        { status: 401 },
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: newEmail.toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Email is already in use" },
        { status: 409 },
      );
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
    return NextResponse.json(
      { error: "Failed to process email change request" },
      { status: 500 },
    );
  }
}
