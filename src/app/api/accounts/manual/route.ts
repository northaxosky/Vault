import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isDemoMode } from "@/lib/demo";

const VALID_ACCOUNT_TYPES = ["depository", "credit", "investment", "loan"] as const;
type AccountType = (typeof VALID_ACCOUNT_TYPES)[number];

function isValidAccountType(value: string): value is AccountType {
  return (VALID_ACCOUNT_TYPES as readonly string[]).includes(value);
}

export async function POST(request: Request) {
  if (isDemoMode()) {
    return NextResponse.json(
      { error: "Manual account creation is not available in demo mode" },
      { status: 400 },
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { institutionName, accountName, accountType, accountSubtype, startingBalance } = body;

    // --- Validate required fields ---
    if (!institutionName || typeof institutionName !== "string") {
      return NextResponse.json(
        { error: "institutionName is required" },
        { status: 400 },
      );
    }
    if (!accountName || typeof accountName !== "string") {
      return NextResponse.json(
        { error: "accountName is required" },
        { status: 400 },
      );
    }
    if (institutionName.trim().length === 0 || institutionName.length > 100) {
      return NextResponse.json(
        { error: "institutionName must be between 1 and 100 characters" },
        { status: 400 },
      );
    }
    if (accountName.trim().length === 0 || accountName.length > 100) {
      return NextResponse.json(
        { error: "accountName must be between 1 and 100 characters" },
        { status: 400 },
      );
    }

    // --- Validate accountType ---
    if (!accountType || typeof accountType !== "string" || !isValidAccountType(accountType)) {
      return NextResponse.json(
        { error: `accountType must be one of: ${VALID_ACCOUNT_TYPES.join(", ")}` },
        { status: 400 },
      );
    }

    // --- Validate optional fields ---
    if (accountSubtype !== undefined && accountSubtype !== null) {
      if (typeof accountSubtype !== "string" || accountSubtype.length > 100) {
        return NextResponse.json(
          { error: "accountSubtype must be a string of at most 100 characters" },
          { status: 400 },
        );
      }
    }

    const balance = startingBalance !== undefined && startingBalance !== null
      ? Number(startingBalance)
      : 0;

    if (isNaN(balance)) {
      return NextResponse.json(
        { error: "startingBalance must be a valid number" },
        { status: 400 },
      );
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
    return NextResponse.json(
      { error: "Failed to create manual account" },
      { status: 500 },
    );
  }
}

export async function GET() {
  if (isDemoMode()) {
    return NextResponse.json(
      { error: "Manual accounts are not available in demo mode" },
      { status: 400 },
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    return NextResponse.json(
      { error: "Failed to fetch manual accounts" },
      { status: 500 },
    );
  }
}
