import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isDemoMode } from "@/lib/demo";

// --- GET: Fetch recent alerts + unread count ---

export async function GET() {
  if (isDemoMode()) {
    return NextResponse.json({ alerts: [], unreadCount: 0 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [alerts, unreadCount] = await Promise.all([
    prisma.alert.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.alert.count({
      where: { userId: session.user.id, read: false },
    }),
  ]);

  return NextResponse.json({
    alerts: alerts.map((a) => ({
      id: a.id,
      type: a.type,
      title: a.title,
      message: a.message,
      transactionId: a.transactionId,
      read: a.read,
      createdAt: a.createdAt.toISOString(),
    })),
    unreadCount,
  });
}

// --- PATCH: Mark alert(s) as read ---

export async function PATCH(request: Request) {
  if (isDemoMode()) {
    return NextResponse.json({ success: true });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, markAllRead } = body;

    if (markAllRead) {
      await prisma.alert.updateMany({
        where: { userId: session.user.id, read: false },
        data: { read: true },
      });
      return NextResponse.json({ success: true });
    }

    if (!id) {
      return NextResponse.json({ error: "Alert ID or markAllRead is required" }, { status: 400 });
    }

    // Verify ownership
    const alert = await prisma.alert.findUnique({ where: { id } });
    if (!alert || alert.userId !== session.user.id) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }

    await prisma.alert.update({
      where: { id },
      data: { read: true },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error updating alert:", err);
    return NextResponse.json({ error: "Failed to update alert" }, { status: 500 });
  }
}
