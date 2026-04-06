import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { unauthorizedResponse, errorResponse } from "@/lib/api-response";

// --- GET: List linked bank accounts ---
export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return unauthorizedResponse();
  }

  try {
    const plaidItems = await prisma.plaidItem.findMany({
      where: { userId: session.user.id },
      select: {
        id: true,
        institutionName: true,
        createdAt: true,
        accounts: {
          select: {
            id: true,
            name: true,
            type: true,
            subtype: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ linkedAccounts: plaidItems });
  } catch (error) {
    console.error("Error fetching linked accounts:", error);
    return errorResponse("Failed to fetch linked accounts", 500);
  }
}
