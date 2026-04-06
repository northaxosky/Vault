import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isDemoMode } from "@/lib/demo";
import { unauthorizedResponse, notFoundResponse, validationError, errorResponse, successResponse } from "@/lib/api-response";

// --- GET: Fetch all recurring streams for the current user ---
export async function GET() {
  if (isDemoMode()) {
    return NextResponse.json({ streams: [] });
  }

  const session = await auth();

  if (!session?.user?.id) {
    return unauthorizedResponse();
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
    return errorResponse("Failed to fetch subscriptions", 500);
  }
}

// --- PATCH: Update subscription (toggle cancelled, edit details, etc.) ---
export async function PATCH(request: Request) {
  if (isDemoMode()) {
    return successResponse({ success: true });
  }

  const session = await auth();

  if (!session?.user?.id) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();
    const { id, cancelledByUser, merchantName, lastAmount, frequency } = body;

    if (!id) {
      return validationError("ID is required");
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
      return notFoundResponse("Subscription");
    }

    // Build update data from provided fields
    const updateData: Record<string, unknown> = {};

    if (typeof cancelledByUser === "boolean") {
      updateData.cancelledByUser = cancelledByUser;
      updateData.cancelledAt = cancelledByUser ? new Date() : null;
    }

    if (merchantName !== undefined && merchantName !== null) {
      updateData.merchantName = merchantName || null;
    }

    if (lastAmount !== undefined && lastAmount !== null) {
      updateData.lastAmount = parseFloat(lastAmount);
    }

    if (frequency !== undefined && frequency !== null) {
      // Validate frequency
      const validFrequencies = [
        "WEEKLY",
        "BIWEEKLY",
        "SEMI_MONTHLY",
        "MONTHLY",
        "ANNUALLY",
      ];
      if (!validFrequencies.includes(frequency)) {
        return validationError("Invalid frequency");
      }
      updateData.frequency = frequency;
    }

    if (Object.keys(updateData).length === 0) {
      return validationError("No fields to update");
    }

    const updated = await prisma.recurringStream.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      stream: {
        id: updated.id,
        merchantName: updated.merchantName,
        lastAmount: Number(updated.lastAmount),
        frequency: updated.frequency,
        cancelledByUser: updated.cancelledByUser,
        cancelledAt: updated.cancelledAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    console.error("Error updating subscription:", error);
    return errorResponse("Failed to update subscription", 500);
  }
}

// --- DELETE: Delete a subscription ---
export async function DELETE(request: Request) {
  if (isDemoMode()) {
    return successResponse({ success: true });
  }

  const session = await auth();

  if (!session?.user?.id) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return validationError("ID is required");
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
      return notFoundResponse("Subscription");
    }

    await prisma.recurringStream.delete({
      where: { id },
    });

    return NextResponse.json({
      message: "Subscription deleted successfully",
      id,
    });
  } catch (error) {
    console.error("Error deleting subscription:", error);
    return errorResponse("Failed to delete subscription", 500);
  }
}
