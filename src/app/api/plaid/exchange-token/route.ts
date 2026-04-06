import { NextResponse } from "next/server";
import { CountryCode } from "plaid";
import { auth } from "@/lib/auth";
import { plaidClient, extractPlaidError, logPlaidError } from "@/lib/plaid";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";
import { unauthorizedResponse, validationError } from "@/lib/api-response";

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return unauthorizedResponse();
  }

  try {
    const { publicToken } = await request.json();

    if (!publicToken) {
      return validationError("Public token is required");
    }

    // --- Step 3 of the Plaid flow ---
    // Exchange the one-time public token for a permanent access token.
    // The public token came from the browser (via Plaid Link UI).
    // The access token is what we'll use for all future API calls.
    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    });

    const accessToken = exchangeResponse.data.access_token;
    const itemId = exchangeResponse.data.item_id;

    // --- Encrypt the access token before storing ---
    // This token is like a password to someone's bank account.
    // We encrypt it with AES-256-GCM so even if our database leaks,
    // the tokens are useless without the encryption key.
    const encryptedAccessToken = encrypt(accessToken);

    // --- Get institution info (bank name) ---
    const itemResponse = await plaidClient.itemGet({
      access_token: accessToken,
    });
    const institutionId = itemResponse.data.item.institution_id;

    let institutionName = null;
    if (institutionId) {
      const instResponse = await plaidClient.institutionsGetById({
        institution_id: institutionId,
        country_codes: [CountryCode.Us],
      });
      institutionName = instResponse.data.institution.name;
    }

    // --- Save the PlaidItem to our database ---
    const plaidItem = await prisma.plaidItem.create({
      data: {
        userId: session.user.id,
        plaidItemId: itemId,
        accessToken: encryptedAccessToken,
        institutionName,
      },
    });

    // --- Fetch and save the accounts ---
    const accountsResponse = await plaidClient.accountsGet({
      access_token: accessToken,
    });

    for (const account of accountsResponse.data.accounts) {
      await prisma.account.create({
        data: {
          plaidItemId: plaidItem.id,
          plaidAccountId: account.account_id,
          name: account.name,
          officialName: account.official_name || null,
          type: account.type,
          subtype: account.subtype || null,
          currentBalance: account.balances.current,
          availableBalance: account.balances.available,
          currency: account.balances.iso_currency_code || "USD",
        },
      });
    }

    return NextResponse.json({
      success: true,
      institutionName,
      accountCount: accountsResponse.data.accounts.length,
    });
  } catch (error) {
    logPlaidError("exchange-token", error);
    const detail = extractPlaidError(error);
    return NextResponse.json(
      {
        error: "Failed to link account",
        plaidError: detail?.displayMessage
          ? { message: detail.displayMessage }
          : undefined,
      },
      { status: detail?.statusCode || 500 }
    );
  }
}
