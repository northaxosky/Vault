import { plaidClient, logPlaidError } from "@/lib/plaid";
import type { SyncContext } from "./types";

/**
 * Sync investment holdings for a single Plaid item.
 * Upserts securities and holdings, then removes stale positions.
 *
 * Uses prisma.$transaction for batched holding upserts to fix N+1.
 *
 * Returns true on success, false if the API call failed (non-fatal).
 */
export async function syncInvestments(ctx: SyncContext): Promise<boolean> {
  const { prisma, accessToken, accountMap } = ctx;

  try {
    const investResponse = await plaidClient.investmentsHoldingsGet({
      access_token: accessToken,
    });

    const { holdings, securities } = investResponse.data;

    // Upsert securities and build lookup: Plaid security_id -> our Security.id
    const securityMap = new Map<string, string>();

    for (const sec of securities) {
      const upserted = await prisma.security.upsert({
        where: { plaidSecurityId: sec.security_id },
        update: {
          name: sec.name ?? undefined,
          ticker: sec.ticker_symbol ?? undefined,
          type: sec.type ?? undefined,
        },
        create: {
          plaidSecurityId: sec.security_id,
          name: sec.name ?? undefined,
          ticker: sec.ticker_symbol ?? undefined,
          type: sec.type ?? undefined,
        },
      });
      securityMap.set(sec.security_id, upserted.id);
    }

    // Batch upsert holdings inside a transaction to reduce round-trips
    const upsertedHoldingIds = await prisma.$transaction(async (tx) => {
      const ids: string[] = [];

      for (const holding of holdings) {
        const ourAccountId = accountMap.get(holding.account_id);
        const ourSecurityId = securityMap.get(holding.security_id);
        if (!ourAccountId || !ourSecurityId) continue;

        const holdingData = {
          quantity: holding.quantity,
          costBasis: holding.cost_basis,
          currentValue: holding.institution_value,
          currency: holding.iso_currency_code || "USD",
        };

        // Use compound unique key for upsert
        const upserted = await tx.investmentHolding.upsert({
          where: {
            accountId_securityId: {
              accountId: ourAccountId,
              securityId: ourSecurityId,
            },
          },
          update: holdingData,
          create: {
            accountId: ourAccountId,
            securityId: ourSecurityId,
            ...holdingData,
          },
          select: { id: true },
        });

        ids.push(upserted.id);
      }

      return ids;
    });

    // Remove stale holdings (sold positions)
    const syncedAccountIds = [...accountMap.values()];
    if (syncedAccountIds.length > 0) {
      await prisma.investmentHolding.deleteMany({
        where: {
          accountId: { in: syncedAccountIds },
          id: { notIn: upsertedHoldingIds },
        },
      });
    }

    return true;
  } catch (error) {
    logPlaidError("sync/investments (non-fatal)", error);
    return false;
  }
}
