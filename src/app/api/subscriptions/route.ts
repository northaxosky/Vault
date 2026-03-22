import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// --- GET: Fetch all recurring streams for the current user ---
export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const streams = await prisma.recurringStream.findMany({
      where: {
        account: {
          plaidItem: { userId: session.user.id },
        },
      },
      include: {
        account: { select: { name: true } },
      },
      orderBy: [
        { isActive: "desc" },
        { merchantName: "asc" },
      ],
    });

    return NextResponse.json({
      streams: streams.map((s) => ({
        id: s.id,
        plaidStreamId: s.plaidStreamId,
        merchantName: s.merchantName,
        description: s.description,
        category: s.category,
        subcategory: s.subcategory,
        firstDate: s.firstDate.toISOString(),
        lastDate: s.lastDate.toISOString(),
        lastAmount: Number(s.lastAmount),
        averageAmount: Number(s.averageAmount),
        predictedNextDate: s.predictedNextDate?.toISOString() ?? null,
        frequency: s.frequency,
        isActive: s.isActive,
        status: s.status,
        streamType: s.streamType,
        currency: s.currency,
        cancelledByUser: s.cancelledByUser,
        cancelledAt: s.cancelledAt?.toISOString() ?? null,
        accountName: s.account.name,
      })),
    });
  } catch (error) {
    console.error("Error fetching subscriptions:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscriptions" },
      { status: 500 }
    );
  }
}

// --- PATCH: Toggle a subscription's cancelled status ---
export async function PATCH(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, cancelledByUser } = body;

    if (!id || typeof cancelledByUser !== "boolean") {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    // Verify ownership: stream -> account -> plaidItem -> userId
    const stream = await prisma.recurringStream.findUnique({
      where: { id },
      include: {
        account: {
          include: { plaidItem: { select: { userId: true } } },
        },
      },
    });

    if (!stream || stream.account.plaidItem.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Subscription not found" },
        { status: 404 }
      );
    }

    const updated = await prisma.recurringStream.update({
      where: { id },
      data: {
        cancelledByUser,
        cancelledAt: cancelledByUser ? new Date() : null,
      },
    });

    return NextResponse.json({
      stream: {
        id: updated.id,
        cancelledByUser: updated.cancelledByUser,
        cancelledAt: updated.cancelledAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    console.error("Error updating subscription:", error);
    return NextResponse.json(
      { error: "Failed to update subscription" },
      { status: 500 }
    );
  }
}
