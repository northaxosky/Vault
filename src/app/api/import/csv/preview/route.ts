import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { parseCsv, parseCsvText, type CsvFormatId } from "@/lib/csv-parser";
import { detectPortfolioFormat, parsePortfolioCsv } from "@/lib/portfolio-parser";
import { unauthorizedResponse, validationError, errorResponse } from "@/lib/api-response";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_PREVIEW_ROWS = 5;

const VALID_FORMATS: Set<string> = new Set([
  "first-tech",
  "amex",
  "chase",
  "generic",
]);

// ---------------------------------------------------------------------------
// POST /api/import/csv/preview — parse CSV server-side for preview
// Auto-detects whether the file is transactions or portfolio positions.
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return unauthorizedResponse();
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const formatRaw = formData.get("format");

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

    // --- Check if this is a portfolio file (Fidelity positions) ---
    const { headers } = parseCsvText(csvText);
    if (detectPortfolioFormat(headers)) {
      const portfolio = parsePortfolioCsv(csvText);

      if (portfolio.positions.length === 0 && portfolio.cashPositions.length === 0 && portfolio.errors.length > 0) {
        return validationError(portfolio.errors[0]);
      }

      const positionTotal = portfolio.positions.reduce((sum, p) => sum + p.currentValue, 0);
      const cashTotal = portfolio.cashPositions.reduce((sum, c) => sum + c.currentValue, 0);

      return NextResponse.json({
        type: "portfolio" as const,
        accounts: portfolio.accounts,
        positions: portfolio.positions.slice(0, MAX_PREVIEW_ROWS * 4).map((p) => ({
          accountName: p.accountName,
          ticker: p.ticker,
          quantity: p.quantity,
          currentValue: p.currentValue,
          costBasis: p.costBasis,
        })),
        totalPositions: portfolio.positions.length,
        totalValue: Math.round((positionTotal + cashTotal) * 100) / 100,
        errors: portfolio.errors,
      });
    }

    // --- Otherwise parse as transactions ---
    let formatOverride: CsvFormatId | undefined;
    if (formatRaw) {
      const fmt = String(formatRaw);
      if (VALID_FORMATS.has(fmt)) {
        formatOverride = fmt as CsvFormatId;
      }
    }

    const result = parseCsv(csvText, formatOverride);

    if (result.transactions.length === 0 && result.errors.length > 0) {
      return validationError(result.errors[0]);
    }

    return NextResponse.json({
      type: "transactions" as const,
      format: result.format,
      totalRows: result.transactions.length,
      skippedRows: result.skippedRows,
      errors: result.errors,
      sampleRows: result.transactions.slice(0, MAX_PREVIEW_ROWS).map((t) => ({
        date: t.date.toISOString().split("T")[0],
        name: t.name,
        amount: t.amount,
        category: t.category,
      })),
    });
  } catch (error) {
    console.error("CSV preview error:", error);
    return errorResponse("Failed to parse CSV", 500);
  }
}
