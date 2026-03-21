import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AccountsClient from "@/components/AccountsClient";

export default async function AccountsPage() {
  const session = await auth();

  // Fetch all linked institutions with accounts, including transaction
  // counts per account. Prisma's _count feature lets us get this in
  // a single query rather than doing a separate COUNT(*) per account.
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
          _count: {
            select: { transactions: true },
          },
        },
        orderBy: { name: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Serialize for the client component:
  // - Decimal → Number()
  // - DateTime → .toISOString()
  // - _count → transactionCount (flatten the nested object)
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
      transactionCount: acc._count.transactions,
    })),
  }));

  return <AccountsClient institutions={institutions} />;
}
