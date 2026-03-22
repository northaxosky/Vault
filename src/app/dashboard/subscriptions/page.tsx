import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import SubscriptionsClient from "@/components/SubscriptionsClient";

export default async function SubscriptionsPage() {
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
