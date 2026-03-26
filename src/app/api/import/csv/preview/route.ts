import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { parseCsv, type CsvFormatId } from "@/lib/csv-parser";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_PREVIEW_ROWS = 5;

const VALID_FORMATS: Set<string> = new Set([
  "first-tech",
  "amex",
  "chase",
  "robinhood",
  "generic",
]);

// ---------------------------------------------------------------------------
// POST /api/import/csv/preview — parse CSV server-side for preview
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const formatRaw = formData.get("format");

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

    let formatOverride: CsvFormatId | undefined;
    if (formatRaw) {
      const fmt = String(formatRaw);
      if (VALID_FORMATS.has(fmt)) {
        formatOverride = fmt as CsvFormatId;
      }
    }

    const csvText = await file.text();
    const result = parseCsv(csvText, formatOverride);

    if (result.transactions.length === 0 && result.errors.length > 0) {
      return NextResponse.json(
        { error: result.errors[0] },
        { status: 400 },
      );
    }

    return NextResponse.json({
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
    return NextResponse.json(
      { error: "Failed to parse CSV" },
      { status: 500 },
    );
  }
}
