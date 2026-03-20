import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// --- GET: Export all user data as JSON ---
export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Fetch everything related to this user
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        settings: true,
        plaidItems: {
          select: {
            institutionName: true,
            createdAt: true,
            accounts: {
              select: {
                name: true,
                officialName: true,
                type: true,
                subtype: true,
                currentBalance: true,
                availableBalance: true,
                currency: true,
                transactions: {
                  select: {
                    name: true,
                    merchantName: true,
                    amount: true,
                    date: true,
                    category: true,
                    subcategory: true,
                    pending: true,
                    currency: true,
                  },
                  orderBy: { date: "desc" },
                },
                holdings: {
                  select: {
                    quantity: true,
                    costBasis: true,
                    currentValue: true,
                    currency: true,
                    security: {
                      select: {
                        name: true,
                        ticker: true,
                        type: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Return as a downloadable JSON file
    return new NextResponse(JSON.stringify(user, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="vault-export-${new Date().toISOString().split("T")[0]}.json"`,
      },
    });
  } catch (error) {
    console.error("Error exporting data:", error);
    return NextResponse.json(
      { error: "Failed to export data" },
      { status: 500 }
    );
  }
}
