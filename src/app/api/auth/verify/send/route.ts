import { NextResponse } from "next/server";
import crypto from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email";
import { unauthorizedResponse, validationError } from "@/lib/api-response";

export async function POST() {
  const session = await auth();

  if (!session?.user?.email) {
    return unauthorizedResponse();
  }

  const { email } = session.user;

  const user = await prisma.user.findUnique({
    where: { email },
    select: { emailVerified: true },
  });

  if (user?.emailVerified) {
    return validationError("Email already verified");
  }

  const token = crypto.randomUUID();
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  // Delete any existing tokens for this email, then create a new one
  await prisma.$transaction([
    prisma.verificationToken.deleteMany({ where: { email } }),
    prisma.verificationToken.create({ data: { email, token, expires } }),
  ]);

  await sendVerificationEmail(email, token);

  return NextResponse.json({ message: "Verification email sent" });
}
