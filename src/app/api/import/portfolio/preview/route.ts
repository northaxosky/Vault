import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { parsePortfolioCsv } from "@/lib/portfolio-parser";
import { unauthorizedResponse, validationError, errorResponse } from "@/lib/api-response";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_PREVIEW_ROWS = 20;

// ---------------------------------------------------------------------------
// POST /api/import/portfolio/preview — parse CSV server-side for preview
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return unauthorizedResponse();
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return validationError("A CSV file is required");
    }

    if (file.size === 0) {
      return validationError("The uploaded file is empty");
    }

    if (file.size > MAX_FILE_SIZE) {
      return validationError("File exceeds the 5 MB size limit");
    }

    const csvText = await file.text();
    const result = parsePortfolioCsv(csvText);

    if (
      result.positions.length === 0 &&
      result.cashPositions.length === 0 &&
      result.errors.length > 0
    ) {
      return validationError(result.errors[0]);
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
    return errorResponse("Failed to parse portfolio CSV", 500);
  }
}
