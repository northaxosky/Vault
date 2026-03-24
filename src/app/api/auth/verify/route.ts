import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return Response.redirect(new URL("/login?error=invalid-token", request.url));
  }

  const verificationToken = await prisma.verificationToken.findUnique({
    where: { token },
  });

  if (!verificationToken || verificationToken.expires < new Date()) {
    // Clean up expired token if it exists
    if (verificationToken) {
      await prisma.verificationToken.delete({ where: { id: verificationToken.id } });
    }
    return Response.redirect(new URL("/login?error=invalid-token", request.url));
  }

  // Mark user as verified and delete the token
  await prisma.$transaction([
    prisma.user.update({
      where: { email: verificationToken.email },
      data: { emailVerified: new Date() },
    }),
    prisma.verificationToken.delete({ where: { id: verificationToken.id } }),
  ]);

  return Response.redirect(new URL("/dashboard?verified=true", request.url));
}
