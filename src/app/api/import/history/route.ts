import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isDemoMode } from "@/lib/demo";

interface BatchRow {
  importBatchId: string;
  accountId: string;
  transactionCount: bigint;
  minDate: Date;
  maxDate: Date;
  importedAt: Date;
}

export async function GET() {
  if (isDemoMode()) {
    return NextResponse.json([]);
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userId = session.user.id;

    // Raw GROUP BY to get batch summaries in a single query.
    // Joins Transaction → Account → PlaidItem to verify user ownership.
    const batches = await prisma.$queryRaw<BatchRow[]>`
      SELECT
        t."importBatchId",
        t."accountId",
        COUNT(*)::bigint           AS "transactionCount",
        MIN(t."date")              AS "minDate",
        MAX(t."date")              AS "maxDate",
        MIN(t."createdAt")         AS "importedAt"
      FROM "Transaction" t
      JOIN "Account" a   ON a."id" = t."accountId"
      JOIN "PlaidItem" p ON p."id" = a."plaidItemId"
      WHERE p."userId" = ${userId}
        AND t."importBatchId" IS NOT NULL
      GROUP BY t."importBatchId", t."accountId"
      ORDER BY MIN(t."createdAt") DESC
    `;

    // Collect the unique account IDs so we can fetch names in one query
    const accountIds = [...new Set(batches.map((b) => b.accountId))];

    const accounts =
      accountIds.length > 0
        ? await prisma.account.findMany({
            where: { id: { in: accountIds } },
            select: {
              id: true,
              name: true,
              plaidItem: { select: { institutionName: true } },
            },
          })
        : [];

    const accountMap = new Map(
      accounts.map((a) => [
        a.id,
        {
          accountName: a.name,
          institutionName: a.plaidItem.institutionName ?? "Unknown",
        },
      ]),
    );

    const result = batches.map((b) => {
      const info = accountMap.get(b.accountId);
      return {
        batchId: b.importBatchId,
        accountId: b.accountId,
        accountName: info?.accountName ?? "Unknown Account",
        institutionName: info?.institutionName ?? "Unknown",
        transactionCount: Number(b.transactionCount),
        dateRange: {
          from: b.minDate.toISOString().slice(0, 10),
          to: b.maxDate.toISOString().slice(0, 10),
        },
        importedAt: b.importedAt.toISOString(),
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching import history:", error);
    return NextResponse.json(
      { error: "Failed to fetch import history" },
      { status: 500 },
    );
  }
}
