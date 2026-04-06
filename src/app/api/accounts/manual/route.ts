import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isDemoMode } from "@/lib/demo";
import { unauthorizedResponse, validationError, errorResponse } from "@/lib/api-response";

const VALID_ACCOUNT_TYPES = ["depository", "credit", "investment", "loan"] as const;
type AccountType = (typeof VALID_ACCOUNT_TYPES)[number];

function isValidAccountType(value: string): value is AccountType {
  return (VALID_ACCOUNT_TYPES as readonly string[]).includes(value);
}

export async function POST(request: Request) {
  if (isDemoMode()) {
    return validationError("Manual account creation is not available in demo mode");
  }

  const session = await auth();
  if (!session?.user?.id) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();
    const { institutionName, accountName, accountType, accountSubtype, startingBalance } = body;

    // --- Validate required fields ---
    if (!institutionName || typeof institutionName !== "string") {
      return validationError("institutionName is required");
    }
    if (!accountName || typeof accountName !== "string") {
      return validationError("accountName is required");
    }
    if (institutionName.trim().length === 0 || institutionName.length > 100) {
      return validationError("institutionName must be between 1 and 100 characters");
    }
    if (accountName.trim().length === 0 || accountName.length > 100) {
      return validationError("accountName must be between 1 and 100 characters");
    }

    // --- Validate accountType ---
    if (!accountType || typeof accountType !== "string" || !isValidAccountType(accountType)) {
      return validationError(`accountType must be one of: ${VALID_ACCOUNT_TYPES.join(", ")}`);
    }

    // --- Validate optional fields ---
    if (accountSubtype !== undefined && accountSubtype !== null) {
      if (typeof accountSubtype !== "string" || accountSubtype.length > 100) {
        return validationError("accountSubtype must be a string of at most 100 characters");
      }
    }

    const balance = startingBalance !== undefined && startingBalance !== null
      ? Number(startingBalance)
      : 0;

    if (isNaN(balance)) {
      return validationError("startingBalance must be a valid number");
    }

    // --- Create the manual PlaidItem + Account in a transaction ---
    const manualItemId = `manual_${randomUUID()}`;
    const manualAccountId = `manual_acct_${randomUUID()}`;

    const result = await prisma.$transaction(async (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => {
      const plaidItem = await tx.plaidItem.create({
        data: {
          userId: session.user.id,
          plaidItemId: manualItemId,
          accessToken: "manual",
          institutionName: institutionName.trim(),
          isManual: true,
        },
      });

      const account = await tx.account.create({
        data: {
          plaidItemId: plaidItem.id,
          plaidAccountId: manualAccountId,
          name: accountName.trim(),
          type: accountType,
          subtype: accountSubtype?.trim() || null,
          currentBalance: balance,
          currency: "USD",
        },
      });

      return { plaidItem, account };
    });

    return NextResponse.json(
      {
        institutionId: result.plaidItem.id,
        accountId: result.account.id,
        institutionName: result.plaidItem.institutionName,
        accountName: result.account.name,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error creating manual account:", error);
    return errorResponse("Failed to create manual account", 500);
  }
}

export async function GET() {
  if (isDemoMode()) {
    return validationError("Manual accounts are not available in demo mode");
  }

  const session = await auth();
  if (!session?.user?.id) {
    return unauthorizedResponse();
  }

  try {
    const manualItems = await prisma.plaidItem.findMany({
      where: {
        userId: session.user.id,
        isManual: true,
      },
      include: {
        accounts: {
          select: {
            id: true,
            name: true,
            type: true,
            subtype: true,
            currentBalance: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const response = manualItems.map((item) => ({
      id: item.id,
      institutionName: item.institutionName,
      accounts: item.accounts.map((account) => ({
        id: account.id,
        name: account.name,
        type: account.type,
        subtype: account.subtype,
        currentBalance: account.currentBalance ? Number(account.currentBalance) : 0,
      })),
    }));

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching manual accounts:", error);
    return errorResponse("Failed to fetch manual accounts", 500);
  }
}
