import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { parsePortfolioCsv } from "@/lib/portfolio-parser";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_PREVIEW_ROWS = 20;

// ---------------------------------------------------------------------------
// POST /api/import/portfolio/preview — parse CSV server-side for preview
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "A CSV file is required" },
        { status: 400 },
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        { error: "The uploaded file is empty" },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File exceeds the 5 MB size limit" },
        { status: 400 },
      );
    }

    const csvText = await file.text();
    const result = parsePortfolioCsv(csvText);

    if (
      result.positions.length === 0 &&
      result.cashPositions.length === 0 &&
      result.errors.length > 0
    ) {
      return NextResponse.json(
        { error: result.errors[0] },
        { status: 400 },
      );
    }

    // Compute total value (positions + cash)
    const positionTotal = result.positions.reduce(
      (sum, p) => sum + p.currentValue,
      0,
    );
    const cashTotal = result.cashPositions.reduce(
      (sum, c) => sum + c.currentValue,
      0,
    );

    return NextResponse.json({
      accounts: result.accounts,
      positions: result.positions.slice(0, MAX_PREVIEW_ROWS).map((p) => ({
        accountName: p.accountName,
        ticker: p.ticker,
        quantity: p.quantity,
        currentValue: p.currentValue,
        costBasis: p.costBasis,
      })),
      totalPositions: result.positions.length,
      totalValue: Math.round((positionTotal + cashTotal) * 100) / 100,
      errors: result.errors,
    });
  } catch (error) {
    console.error("Portfolio preview error:", error);
    return NextResponse.json(
      { error: "Failed to parse portfolio CSV" },
      { status: 500 },
    );
  }
}
