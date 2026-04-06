import { NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";
import { validatePassword, BCRYPT_ROUNDS } from "@/lib/validation";
import { errorResponse } from "@/lib/api-response";

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for") ?? "unknown";
    const { success, remaining } = rateLimit(`auth:${ip}`, {
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
    const body = await request.json();
    const { email, password, name } = body;

    // --- Validation ---
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400, headers: { "X-RateLimit-Remaining": String(remaining) } }
      );
    }

    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      return NextResponse.json(
        { error: passwordCheck.message },
        { status: 400, headers: { "X-RateLimit-Remaining": String(remaining) } }
      );
    }

    const genericMessage =
      "Registration successful. Please check your email to verify your account.";

    // Return identical response whether email exists or not to prevent enumeration
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { message: genericMessage },
        { status: 200, headers: { "X-RateLimit-Remaining": String(remaining) } }
      );
    }

    // --- Hash the password ---
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // --- Capitalize each word in the name ---
    const formattedName = name
      ? name.trim().replace(/\b\w/g, (c: string) => c.toUpperCase())
      : null;

    // --- Create the user ---
    await prisma.user.create({
      data: {
        email,
        name: formattedName,
        passwordHash,
      },
    });

    // Send verification email (non-blocking — don't fail registration)
    try {
      const token = crypto.randomUUID();
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await prisma.verificationToken.create({ data: { email, token, expires } });
      await sendVerificationEmail(email, token);
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError);
    }

    return NextResponse.json(
      { message: genericMessage },
      { status: 200, headers: { "X-RateLimit-Remaining": String(remaining) } }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return errorResponse("Something went wrong", 500);
  }
}
