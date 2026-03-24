import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { message: "If an account exists, a reset link has been sent." },
        { status: 200 }
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      // Delete any existing reset tokens for this email
      await prisma.passwordResetToken.deleteMany({ where: { email } });

      const token = crypto.randomUUID();
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await prisma.passwordResetToken.create({
        data: { email, token, expires },
      });

      await sendPasswordResetEmail(email, token);
    }

    return NextResponse.json(
      { message: "If an account exists, a reset link has been sent." },
      { status: 200 }
    );
  } catch (error) {
    console.error("Password reset request error:", error);
    return NextResponse.json(
      { message: "If an account exists, a reset link has been sent." },
      { status: 200 }
    );
  }
}
