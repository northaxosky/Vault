import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import TransactionsClient from "@/components/TransactionsClient";
import { isDemoMode } from "@/lib/demo";
import { DEMO_TRANSACTIONS } from "@/lib/demo-data";

export default async function TransactionsPage() {
  if (isDemoMode()) {
    return <TransactionsClient transactions={DEMO_TRANSACTIONS} />;
  }

  const session = await auth();

  // Query all transactions for the logged-in user.
  // We join through Account → PlaidItem to scope by userId,
  // and include the account name so we can show which account
  // a transaction belongs to.
  const rawTransactions = await prisma.transaction.findMany({
    where: {
      account: {
        plaidItem: { userId: session!.user.id },
      },
    },
    select: {
      id: true,
      name: true,
      merchantName: true,
      amount: true,
      date: true,
      category: true,
      subcategory: true,
      pending: true,
      isRecurring: true,
      recurringFrequency: true,
      currency: true,
      notes: true,
      userCategory: true,
      account: {
        select: { name: true },
      },
    },
    orderBy: { date: "desc" },
  });

  // Serialize for the client component:
  // - Decimal → Number()
  // - DateTime → .toISOString()
  const transactions = rawTransactions.map((txn) => ({
    id: txn.id,
    name: txn.name,
    merchantName: txn.merchantName,
    amount: Number(txn.amount),
    date: txn.date.toISOString(),
    category: txn.category,
    subcategory: txn.subcategory,
    pending: txn.pending,
    isRecurring: txn.isRecurring,
    recurringFrequency: txn.recurringFrequency,
    currency: txn.currency,
    accountName: txn.account.name,
    notes: txn.notes,
    userCategory: txn.userCategory,
  }));

  return <TransactionsClient transactions={transactions} />;
}
