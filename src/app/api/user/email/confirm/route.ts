import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  const settingsUrl = new URL("/dashboard/settings", request.url);

  if (!token) {
    settingsUrl.searchParams.set("email-error", "true");
    return NextResponse.redirect(settingsUrl);
  }

  try {
    const record = await prisma.emailChangeToken.findUnique({
      where: { token },
    });

    if (!record) {
      settingsUrl.searchParams.set("email-error", "true");
      return NextResponse.redirect(settingsUrl);
    }

    if (record.expires < new Date()) {
      await prisma.emailChangeToken.delete({ where: { id: record.id } });
      settingsUrl.searchParams.set("email-error", "true");
      return NextResponse.redirect(settingsUrl);
    }

    // Race condition guard: check the new email isn't taken
    const existingUser = await prisma.user.findUnique({
      where: { email: record.newEmail },
    });

    if (existingUser) {
      await prisma.emailChangeToken.delete({ where: { id: record.id } });
      settingsUrl.searchParams.set("email-error", "true");
      return NextResponse.redirect(settingsUrl);
    }

    await prisma.user.update({
      where: { id: record.userId },
      data: {
        email: record.newEmail,
        emailVerified: new Date(),
      },
    });

    await prisma.emailChangeToken.delete({ where: { id: record.id } });

    settingsUrl.searchParams.set("email-changed", "true");
    return NextResponse.redirect(settingsUrl);
  } catch (error) {
    console.error("Error confirming email change:", error);
    settingsUrl.searchParams.set("email-error", "true");
    return NextResponse.redirect(settingsUrl);
  }
}
