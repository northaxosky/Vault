import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { plaidClient } from "@/lib/plaid";
import { Products, CountryCode } from "plaid";

export async function POST() {
  // --- Authentication check ---
  // This is the pattern for all protected routes:
  // 1. Call auth() to get the current session
  // 2. If no session or no user, return 401
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    // Ask Plaid for a link token
    const response = await plaidClient.linkTokenCreate({
      user: {
        client_user_id: session.user.id, // ties this link to our user
      },
      client_name: "Vault",               // shown in the Plaid UI
      products: [Products.Transactions],   // what data we want access to
      country_codes: [CountryCode.Us],
      language: "en",
    });

    // Return the link token to the browser
    return NextResponse.json({
      linkToken: response.data.link_token,
    });
  } catch (error) {
    console.error("Error creating link token:", error);
    return NextResponse.json(
      { error: "Failed to create link token" },
      { status: 500 }
    );
  }
}
