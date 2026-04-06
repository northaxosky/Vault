import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isDemoMode } from "@/lib/demo";
import { rateLimit } from "@/lib/rate-limit";
import {
  parseCsv,
  generateTransactionId,
  findDuplicates,
  getAvailableFormats,
  type CsvFormatId,
} from "@/lib/csv-parser";
import { unauthorizedResponse, validationError, errorResponse } from "@/lib/api-response";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const VALID_FORMATS: Set<string> = new Set([
  "first-tech",
  "amex",
  "chase",
  "generic",
]);

// ---------------------------------------------------------------------------
// GET /api/import/csv — list available CSV formats
// ---------------------------------------------------------------------------

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return unauthorizedResponse();
  }

  return NextResponse.json({ formats: getAvailableFormats() });
}

// ---------------------------------------------------------------------------
// POST /api/import/csv — upload & import a CSV file
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  // --- Auth ---
  const session = await auth();
  if (!session?.user?.id) {
    return unauthorizedResponse();
  }

  const { success } = rateLimit(`csv-import:${session.user.id}`, {
    max: 10,
    windowMs: 60 * 60 * 1000,
  });
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "3600" } },
    );
  }

  if (isDemoMode()) {
    return validationError("CSV import is disabled in demo mode");
  }

  try {
    // --- Parse FormData ---
    const formData = await request.formData();
    const file = formData.get("file");
    const accountId = formData.get("accountId");
    const formatRaw = formData.get("format");

    // --- Validate inputs ---
    if (!file || !(file instanceof File)) {
      return validationError("A CSV file is required");
    }

    if (file.size === 0) {
      return validationError("The uploaded file is empty");
    }

    if (file.size > MAX_FILE_SIZE) {
      return validationError("File exceeds the 5 MB size limit");
    }

    if (!accountId || typeof accountId !== "string") {
      return validationError("accountId is required");
    }

    let formatOverride: CsvFormatId | undefined;
    if (formatRaw) {
      const fmt = String(formatRaw);
      if (!VALID_FORMATS.has(fmt)) {
        return validationError(`Invalid format "${fmt}". Valid formats: ${[...VALID_FORMATS].join(", ")}`);
      }
      formatOverride = fmt as CsvFormatId;
    }

    // --- Verify account ownership (Account → PlaidItem → userId) ---
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      select: { plaidItem: { select: { userId: true } } },
    });

    if (!account || account.plaidItem.userId !== session.user.id) {
      return errorResponse("Account not found or access denied", 404);
    }

    // --- Read & parse CSV ---
    const csvText = await file.text();
    const { transactions: parsed, format, errors, skippedRows } = parseCsv(
      csvText,
      formatOverride,
    );

    if (parsed.length === 0 && errors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          imported: 0,
          duplicates: 0,
          skipped: skippedRows,
          errors,
          format,
        },
        { status: 400 },
      );
    }

    // --- Deduplicate against existing transactions ---
    const existingTxns = await prisma.transaction.findMany({
      where: { accountId },
      select: { plaidTransactionId: true },
    });
    const existingIds = new Set(existingTxns.map((t) => t.plaidTransactionId));

    const { unique, duplicateCount } = findDuplicates(
      parsed,
      accountId,
      existingIds,
    );

    // --- Build batch and insert ---
    const batchId = `import_${crypto.randomUUID()}`;
    let importedCount = 0;
    let inBatchDuplicates = 0;

    if (unique.length > 0) {
      const records = unique.map((txn) => ({
        accountId,
        plaidTransactionId: generateTransactionId(
          accountId,
          txn.date,
          txn.amount,
          txn.name,
        ),
        name: txn.name,
        merchantName: txn.merchantName,
        amount: txn.amount,
        date: txn.date,
        category: txn.category,
        pending: false,
        importBatchId: batchId,
      }));

      // Deduplicate within the batch (identical date+amount+name → same hash)
      const seen = new Set<string>();
      const dedupedRecords = records.filter((r) => {
        if (seen.has(r.plaidTransactionId)) return false;
        seen.add(r.plaidTransactionId);
        return true;
      });

      inBatchDuplicates = records.length - dedupedRecords.length;
      importedCount = dedupedRecords.length;

      await prisma.transaction.createMany({
        data: dedupedRecords,
        skipDuplicates: true,
      });

      // --- Update account balance ---
      const withBalance = unique
        .filter((txn) => txn.balance !== null)
        .sort((a, b) => b.date.getTime() - a.date.getTime());

      if (withBalance.length > 0) {
        // CSV has explicit balance data (e.g., First Tech) — use most recent
        await prisma.account.update({
          where: { id: accountId },
          data: { currentBalance: withBalance[0].balance! },
        });
      } else {
        // No balance column — compute from transaction sum
        // Negative amounts = income/inflows, positive = spending/outflows
        // Net balance contribution = -sum (inflows add, outflows subtract)
        const netAmount = unique.reduce((sum, txn) => sum - txn.amount, 0);
        const currentAccount = await prisma.account.findUnique({
          where: { id: accountId },
          select: { currentBalance: true },
        });
        const currentBal = Number(currentAccount?.currentBalance ?? 0);
        const newBalance = currentBal + netAmount;
        await prisma.account.update({
          where: { id: accountId },
          data: { currentBalance: Math.round(newBalance * 100) / 100 },
        });
      }
    }

    return NextResponse.json({
      success: true,
      batchId,
      imported: importedCount,
      duplicates: duplicateCount + inBatchDuplicates,
      skipped: skippedRows,
      errors,
      format,
    });
  } catch (error) {
    console.error("CSV import error:", error);
    return errorResponse("Failed to import CSV", 500);
  }
}
