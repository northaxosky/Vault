import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for") ?? "unknown";
    const { success, remaining, resetAt } = rateLimit(`auth:${ip}`, {
      max: 5,
      windowMs: 15 * 60 * 1000,
    });
    if (!success) {
      return NextResponse.json(
        { error: "Too many requests" },
        {
          status: 429,
          headers: {
            "Retry-After": "900",
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { message: "If an account exists, a reset link has been sent." },
        { status: 200, headers: { "X-RateLimit-Remaining": String(remaining) } }
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
      { status: 200, headers: { "X-RateLimit-Remaining": String(remaining) } }
    );
  } catch (error) {
    console.error("Password reset request error:", error);
    return NextResponse.json(
      { message: "If an account exists, a reset link has been sent." },
      { status: 200 }
    );
  }
}
