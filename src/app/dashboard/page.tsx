import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import DashboardClient from "@/components/DashboardClient";

export default async function DashboardPage() {
  const session = await auth();

  // Fetch all linked institutions with their accounts and balances.
  // The layout already guarantees we're logged in, but we still need
  // the session to know *which* user's data to query.
  const plaidItems = await prisma.plaidItem.findMany({
    where: { userId: session!.user.id },
    select: {
      id: true,
      institutionName: true,
      createdAt: true,
      accounts: {
        select: {
          id: true,
          name: true,
          officialName: true,
          type: true,
          subtype: true,
          currentBalance: true,
          availableBalance: true,
          currency: true,
        },
        orderBy: { name: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Compute summary metrics server-side.
  // We do this here (not in the client) because Prisma Decimal types
  // must be converted to plain numbers before crossing the
  // server → client boundary.
  let netWorth = 0;
  let cashTotal = 0; // checking + savings (Plaid type: "depository")
  let creditTotal = 0; // credit cards (amount owed)
  let totalAccounts = 0;

  for (const item of plaidItems) {
    for (const account of item.accounts) {
      totalAccounts++;
      const balance = account.currentBalance
        ? Number(account.currentBalance)
        : 0;

      if (account.type === "credit") {
        // Plaid reports credit balances as positive = money owed
        creditTotal += balance;
        netWorth -= balance;
      } else {
        // Depository (checking/savings), investment, loan, etc.
        if (account.type === "depository") {
          cashTotal += balance;
        }
        netWorth += balance;
      }
    }
  }

  // Serialize for the client component:
  // - Decimal → Number()
  // - DateTime → .toISOString()
  const institutions = plaidItems.map((item) => ({
    id: item.id,
    institutionName: item.institutionName,
    createdAt: item.createdAt.toISOString(),
    accounts: item.accounts.map((acc) => ({
      id: acc.id,
      name: acc.name,
      officialName: acc.officialName,
      type: acc.type,
      subtype: acc.subtype,
      currentBalance: acc.currentBalance ? Number(acc.currentBalance) : null,
      availableBalance: acc.availableBalance
        ? Number(acc.availableBalance)
        : null,
      currency: acc.currency,
    })),
  }));

  return (
    <DashboardClient
      summary={{ netWorth, cashTotal, creditTotal, totalAccounts }}
      institutions={institutions}
    />
  );
}
