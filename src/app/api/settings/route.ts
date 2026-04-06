import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isDemoMode } from "@/lib/demo";
import { DEMO_SETTINGS } from "@/lib/demo-data";
import { unauthorizedResponse, validationError, errorResponse } from "@/lib/api-response";

// --- GET: Fetch user settings (creates defaults if none exist) ---
export async function GET() {
  if (isDemoMode()) {
    return NextResponse.json({ settings: DEMO_SETTINGS });
  }

  const session = await auth();

  if (!session?.user?.id) {
    return unauthorizedResponse();
  }

  try {
    // Upsert pattern: find or create settings with defaults.
    // This means we never need a separate "initialize settings" step —
    // the first time a user visits settings, defaults are created automatically.
    const settings = await prisma.userSettings.upsert({
      where: { userId: session.user.id },
      update: {},
      create: { userId: session.user.id },
    });

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Error fetching settings:", error);
    return errorResponse("Failed to fetch settings", 500);
  }
}

// --- PATCH: Update user settings (accepts partial updates) ---
export async function PATCH(request: Request) {
  if (isDemoMode()) {
    return NextResponse.json({ settings: DEMO_SETTINGS });
  }

  const session = await auth();

  if (!session?.user?.id) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();

    // Validate accentHue if provided
    if (body.accentHue !== undefined) {
      const hue = Number(body.accentHue);
      if (isNaN(hue) || hue < 0 || hue > 360) {
        return validationError("Accent hue must be a number between 0 and 360");
      }
    }

    // Validate currency if provided
    const allowedCurrencies = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY"];
    if (body.currency && !allowedCurrencies.includes(body.currency)) {
      return validationError(`Currency must be one of: ${allowedCurrencies.join(", ")}`);
    }

    // Validate dateFormat if provided
    const allowedFormats = ["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"];
    if (body.dateFormat && !allowedFormats.includes(body.dateFormat)) {
      return validationError(`Date format must be one of: ${allowedFormats.join(", ")}`);
    }

    // Build the update data — only include fields that were sent
    const updateData: Record<string, unknown> = {};
    if (body.accentHue !== undefined) updateData.accentHue = Number(body.accentHue);
    if (body.currency !== undefined) updateData.currency = body.currency;
    if (body.dateFormat !== undefined) updateData.dateFormat = body.dateFormat;
    if (body.emailAlerts !== undefined) updateData.emailAlerts = Boolean(body.emailAlerts);
    if (body.spendingAlert !== undefined) updateData.spendingAlert = body.spendingAlert;
    if (body.lowBalanceAlert !== undefined) updateData.lowBalanceAlert = body.lowBalanceAlert;
    if (body.weeklyDigest !== undefined) updateData.weeklyDigest = Boolean(body.weeklyDigest);
    if (body.dashboardWidgets !== undefined) {
      updateData.dashboardWidgets = Array.isArray(body.dashboardWidgets)
        ? JSON.stringify(body.dashboardWidgets)
        : body.dashboardWidgets;
    }

    // Upsert: update if exists, create with defaults + overrides if not
    const settings = await prisma.userSettings.upsert({
      where: { userId: session.user.id },
      update: updateData,
      create: { userId: session.user.id, ...updateData },
    });

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Error updating settings:", error);
    return errorResponse("Failed to update settings", 500);
  }
}
