import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import SubscriptionsClient from "@/components/SubscriptionsClient";
import { isDemoMode } from "@/lib/demo";
import { DEMO_RECURRING } from "@/lib/demo-data";

export default async function SubscriptionsPage() {
  if (isDemoMode()) {
    const now = new Date();
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    return (
      <SubscriptionsClient
        streams={DEMO_RECURRING.map((r, i) => ({
          id: `sub-${i}`,
          plaidStreamId: `plaid-stream-${i}`,
          merchantName: r.name,
          description: r.name,
          category: "ENTERTAINMENT",
          subcategory: null,
          firstDate: sixMonthsAgo.toISOString(),
          lastDate: now.toISOString(),
          lastAmount: r.amount,
          averageAmount: r.amount,
          predictedNextDate: r.date,
          frequency: r.frequency,
          isActive: true,
          status: "MATURE",
          streamType: "EXPENSE",
          currency: "USD",
          cancelledByUser: false,
          cancelledAt: null,
          accountName: "Chase Checking",
        }))}
      />
    );
  }

  const session = await auth();

  const rawStreams = await prisma.recurringStream.findMany({
    where: {
      account: {
        plaidItem: { userId: session!.user.id },
      },
    },
    include: {
      account: { select: { name: true } },
    },
    orderBy: [
      { isActive: "desc" },
      { merchantName: "asc" },
    ],
  });

  const streams = rawStreams.map((s) => ({
    id: s.id,
    plaidStreamId: s.plaidStreamId,
    merchantName: s.merchantName,
    description: s.description,
    category: s.category,
    subcategory: s.subcategory,
    firstDate: s.firstDate.toISOString(),
    lastDate: s.lastDate.toISOString(),
    lastAmount: Number(s.lastAmount),
    averageAmount: Number(s.averageAmount),
    predictedNextDate: s.predictedNextDate?.toISOString() ?? null,
    frequency: s.frequency,
    isActive: s.isActive,
    status: s.status,
    streamType: s.streamType,
    currency: s.currency,
    cancelledByUser: s.cancelledByUser,
    cancelledAt: s.cancelledAt?.toISOString() ?? null,
    accountName: s.account.name,
  }));

  return <SubscriptionsClient streams={streams} />;
}
