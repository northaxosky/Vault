import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import InvestmentsClient from "@/components/InvestmentsClient";
import { isDemoMode } from "@/lib/demo";

export default async function InvestmentsPage() {
  if (isDemoMode()) {
    return (
      <InvestmentsClient
        accounts={[{
          accountId: "acc-4",
          accountName: "Fidelity 401k",
          institutionName: "Fidelity",
          holdings: [
            { id: "h-1", quantity: 45, costBasis: 7200, currentValue: 8910, currency: "USD", securityName: "Vanguard Total Stock Market ETF", ticker: "VTI", securityType: "etf" },
            { id: "h-2", quantity: 30, costBasis: 5400, currentValue: 6450, currency: "USD", securityName: "Vanguard Total Bond Market ETF", ticker: "BND", securityType: "etf" },
            { id: "h-3", quantity: 20, costBasis: 9000, currentValue: 10200, currency: "USD", securityName: "Vanguard S&P 500 ETF", ticker: "VOO", securityType: "etf" },
            { id: "h-4", quantity: 15, costBasis: 6000, currentValue: 8640, currency: "USD", securityName: "Vanguard International Stock ETF", ticker: "VXUS", securityType: "etf" },
          ],
        }]}
        summary={{ totalValue: 34200, totalCostBasis: 27600, totalGainLoss: 6600, gainLossPercent: 23.91 }}
      />
    );
  }

  const session = await auth();

  // Fetch all investment holdings for this user.
  // We join through Account → PlaidItem to scope by userId,
  // and include the security details (name, ticker, type) and
  // the account info so we can group by account in the UI.
  const rawHoldings = await prisma.investmentHolding.findMany({
    where: {
      account: {
        plaidItem: { userId: session!.user.id },
      },
    },
    select: {
      id: true,
      quantity: true,
      costBasis: true,
      currentValue: true,
      currency: true,
      security: {
        select: {
          id: true,
          name: true,
          ticker: true,
          type: true,
        },
      },
      account: {
        select: {
          id: true,
          name: true,
          plaidItem: {
            select: { institutionName: true },
          },
        },
      },
    },
    orderBy: { currentValue: "desc" },
  });

  // Serialize for the client component:
  // - Decimal → Number()
  // - Group holdings by account for rendering
  const holdingsByAccount = new Map<
    string,
    {
      accountId: string;
      accountName: string;
      institutionName: string | null;
      holdings: typeof serialized;
    }
  >();

  const serialized = rawHoldings.map((h) => ({
    id: h.id,
    quantity: Number(h.quantity),
    costBasis: h.costBasis ? Number(h.costBasis) : null,
    currentValue: h.currentValue ? Number(h.currentValue) : null,
    currency: h.currency,
    securityName: h.security.name,
    ticker: h.security.ticker,
    securityType: h.security.type,
  }));

  // Group holdings by account
  for (let i = 0; i < rawHoldings.length; i++) {
    const raw = rawHoldings[i];
    const holding = serialized[i];
    const accountId = raw.account.id;

    if (!holdingsByAccount.has(accountId)) {
      holdingsByAccount.set(accountId, {
        accountId,
        accountName: raw.account.name,
        institutionName: raw.account.plaidItem.institutionName,
        holdings: [],
      });
    }
    holdingsByAccount.get(accountId)!.holdings.push(holding);
  }

  const accounts = Array.from(holdingsByAccount.values());

  // Compute summary totals
  let totalValue = 0;
  let totalCostBasis = 0;

  for (const h of serialized) {
    if (h.currentValue !== null) totalValue += h.currentValue;
    if (h.costBasis !== null) totalCostBasis += h.costBasis;
  }

  const summary = {
    totalValue,
    totalCostBasis,
    totalGainLoss: totalValue - totalCostBasis,
    gainLossPercent:
      totalCostBasis > 0
        ? ((totalValue - totalCostBasis) / totalCostBasis) * 100
        : 0,
  };

  return <InvestmentsClient accounts={accounts} summary={summary} />;
}
