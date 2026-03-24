import { NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, name } = body;

    // --- Validation ---
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Check if a user with this email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 } // 409 = Conflict
      );
    }

    // --- Hash the password ---
    // The "10" is the salt rounds — how many times bcrypt scrambles the hash.
    // Higher = more secure but slower.
    const passwordHash = await bcrypt.hash(password, 10);

    // --- Capitalize each word in the name ---
    const formattedName = name
      ? name.trim().replace(/\b\w/g, (c: string) => c.toUpperCase())
      : null;

    // --- Create the user ---
    const user = await prisma.user.create({
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
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
