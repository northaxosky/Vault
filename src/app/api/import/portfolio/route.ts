import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isDemoMode } from "@/lib/demo";
import {
  parsePortfolioCsv,
  detectPortfolioFormat,
} from "@/lib/portfolio-parser";
import { parseCsvLine } from "@/lib/csv-parser";
import { unauthorizedResponse, validationError, errorResponse } from "@/lib/api-response";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

// ---------------------------------------------------------------------------
// GET /api/import/portfolio — check if portfolio import is available
// ---------------------------------------------------------------------------

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return unauthorizedResponse();
  }

  return NextResponse.json({
    supported: true,
    description: "Fidelity Portfolio Positions CSV",
  });
}

// ---------------------------------------------------------------------------
// POST /api/import/portfolio — upload & import a portfolio positions CSV
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  // --- Auth ---
  const session = await auth();
  if (!session?.user?.id) {
    return unauthorizedResponse();
  }

  if (isDemoMode()) {
    return validationError("Portfolio import is disabled in demo mode");
  }

  const userId = session.user.id;

  try {
    // --- Parse FormData ---
    const formData = await request.formData();
    const file = formData.get("file");

    // --- Validate file ---
    if (!file || !(file instanceof File)) {
      return validationError("A CSV file is required");
    }

    if (file.size === 0) {
      return validationError("The uploaded file is empty");
    }

    if (file.size > MAX_FILE_SIZE) {
      return validationError("File exceeds the 5 MB size limit");
    }

    // --- Read CSV text and verify format ---
    const csvText = await file.text();
    const lines = csvText
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .filter((l) => l.trim().length > 0);

    if (lines.length < 2) {
      return validationError("CSV file is empty or has no data rows");
    }

    const headers = parseCsvLine(lines[0]);
    if (!detectPortfolioFormat(headers)) {
      return validationError(
        "File does not appear to be a Fidelity portfolio positions CSV. " +
        "Please export your positions from Fidelity and try again.",
      );
    }

    // --- Parse positions ---
    const result = parsePortfolioCsv(csvText);

    if (result.positions.length === 0 && result.cashPositions.length === 0) {
      return NextResponse.json(
        {
          success: false,
          accounts: 0,
          positions: 0,
          cashPositions: 0,
          totalValue: 0,
          errors:
            result.errors.length > 0
              ? result.errors
              : ["No positions found in the CSV file"],
        },
        { status: 400 },
      );
    }

    // --- Build account-level aggregations ---
    // Map: accountKey → { accountNumber, accountName, positions, cashTotal, positionTotal }
    const accountAgg = new Map<
      string,
      {
        accountNumber: string;
        accountName: string;
        positions: typeof result.positions;
        cashTotal: number;
        positionTotal: number;
      }
    >();

    for (const acct of result.accounts) {
      const key = `${acct.accountNumber}|${acct.accountName}`;
      if (!accountAgg.has(key)) {
        accountAgg.set(key, {
          accountNumber: acct.accountNumber,
          accountName: acct.accountName,
          positions: [],
          cashTotal: 0,
          positionTotal: 0,
        });
      }
    }

    for (const pos of result.positions) {
      const key = `${pos.accountNumber}|${pos.accountName}`;
      const agg = accountAgg.get(key);
      if (agg) {
        agg.positions.push(pos);
        agg.positionTotal += pos.currentValue;
      }
    }

    for (const cash of result.cashPositions) {
      const key = `${cash.accountNumber}|${cash.accountName}`;
      const agg = accountAgg.get(key);
      if (agg) {
        agg.cashTotal += cash.currentValue;
      }
    }

    // --- Upsert institutions, accounts, securities, and holdings ---
    let totalPositionsUpserted = 0;
    let totalValue = 0;
    const errors: string[] = [...result.errors];

    // Map: accountKey → accountId (DB id)
    const accountIdMap = new Map<string, string>();

    // Step 1: Ensure PlaidItem + Account for each Fidelity account
    for (const [key, agg] of accountAgg) {
      const institutionName = `Fidelity - ${agg.accountName}`;
      const accountBalance = agg.positionTotal + agg.cashTotal;
      totalValue += accountBalance;

      try {
        // Look for existing manual PlaidItem for this user + institution name
        let plaidItem = await prisma.plaidItem.findFirst({
          where: {
            userId,
            institutionName,
            isManual: true,
          },
          include: { accounts: true },
        });

        if (!plaidItem) {
          // Create a manual PlaidItem + Account
          plaidItem = await prisma.plaidItem.create({
            data: {
              userId,
              plaidItemId: `manual_fidelity_${crypto.randomUUID()}`,
              accessToken: "manual_import",
              institutionName,
              isManual: true,
              accounts: {
                create: {
                  plaidAccountId: `manual_acct_${crypto.randomUUID()}`,
                  name: agg.accountName,
                  type: "investment",
                  subtype: agg.accountName,
                  currentBalance: accountBalance,
                },
              },
            },
            include: { accounts: true },
          });
        }

        // Find or use the first account under this PlaidItem
        const account = plaidItem.accounts[0];
        if (!account) {
          errors.push(
            `Failed to find/create account for "${agg.accountName}"`,
          );
          continue;
        }

        // Update the account balance to reflect current CSV data
        await prisma.account.update({
          where: { id: account.id },
          data: { currentBalance: accountBalance },
        });

        accountIdMap.set(key, account.id);
      } catch (e) {
        errors.push(
          `Account "${agg.accountName}": ${e instanceof Error ? e.message : "unknown error"}`,
        );
      }
    }

    // Step 2: Upsert Securities + Holdings for each position
    for (const pos of result.positions) {
      const key = `${pos.accountNumber}|${pos.accountName}`;
      const accountId = accountIdMap.get(key);
      if (!accountId) continue;

      try {
        // Upsert Security by ticker — find existing or create
        let security = await prisma.security.findFirst({
          where: { ticker: pos.ticker },
        });

        if (!security) {
          security = await prisma.security.create({
            data: {
              plaidSecurityId: `manual_sec_${pos.ticker}`,
              name: pos.name,
              ticker: pos.ticker,
              type: pos.type,
            },
          });
        } else {
          // Update name/type if they've changed
          await prisma.security.update({
            where: { id: security.id },
            data: {
              name: pos.name,
              ...(pos.type ? { type: pos.type } : {}),
            },
          });
        }

        // Upsert InvestmentHolding by [accountId, securityId]
        await prisma.investmentHolding.upsert({
          where: {
            accountId_securityId: {
              accountId,
              securityId: security.id,
            },
          },
          update: {
            quantity: pos.quantity,
            costBasis: pos.costBasis,
            currentValue: pos.currentValue,
          },
          create: {
            accountId,
            securityId: security.id,
            quantity: pos.quantity,
            costBasis: pos.costBasis,
            currentValue: pos.currentValue,
            currency: "USD",
          },
        });

        totalPositionsUpserted++;
      } catch (e) {
        errors.push(
          `Position "${pos.ticker}": ${e instanceof Error ? e.message : "unknown error"}`,
        );
      }
    }

    return NextResponse.json({
      success: true,
      accounts: accountAgg.size,
      positions: totalPositionsUpserted,
      cashPositions: result.cashPositions.length,
      totalValue: Math.round(totalValue * 100) / 100,
      errors,
    });
  } catch (error) {
    console.error("Portfolio import error:", error);
    return errorResponse("Failed to import portfolio CSV", 500);
  }
}
