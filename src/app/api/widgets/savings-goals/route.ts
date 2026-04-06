import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isDemoMode } from "@/lib/demo";
import { DEMO_SAVINGS_GOALS } from "@/lib/demo-data";
import { unauthorizedResponse, errorResponse } from "@/lib/api-response";

export async function GET() {
  if (isDemoMode()) {
    return NextResponse.json({ goals: DEMO_SAVINGS_GOALS });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return unauthorizedResponse();
  }

  try {
    const goals = await prisma.savingsGoal.findMany({
      where: { userId: session.user.id },
      select: {
        name: true,
        targetAmount: true,
        currentAmount: true,
        deadline: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      goals: goals.map((g) => {
        const target = Number(g.targetAmount);
        const current = Number(g.currentAmount);
        const percentage = target > 0 ? Math.min(Math.round((current / target) * 100), 100) : 0;

        return {
          name: g.name,
          target,
          current,
          percentage,
          deadline: g.deadline?.toISOString() ?? null,
        };
      }),
    });
  } catch (error) {
    console.error("Error fetching savings goals widget:", error);
    return errorResponse("Failed to fetch savings goals", 500);
  }
}
