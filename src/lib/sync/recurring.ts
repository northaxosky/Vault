import { plaidClient, logPlaidError } from "@/lib/plaid";
import type { SyncContext } from "./types";

/**
 * Sync recurring transaction streams from Plaid for a single item.
 * Upserts RecurringStream records and updates per-transaction recurring flags.
 *
 * Returns true on success, false if the API call failed (non-fatal).
 */
export async function syncRecurring(ctx: SyncContext): Promise<boolean> {
  const { prisma, accessToken, accountMap } = ctx;

  try {
    const recurringResponse = await plaidClient.transactionsRecurringGet({
      access_token: accessToken,
      account_ids: [...accountMap.keys()],
    });

    const { inflow_streams, outflow_streams } = recurringResponse.data;
    const allStreams = [...inflow_streams, ...outflow_streams];

    const syncedStreamIds: string[] = [];

    // Batch-fetch existing streams to preserve user cancellation overrides
    const existingStreams = await prisma.recurringStream.findMany({
      where: {
        plaidStreamId: { in: allStreams.map((s) => s.stream_id) },
      },
      select: { plaidStreamId: true, cancelledByUser: true, cancelledAt: true },
    });
    const existingMap = new Map(
      existingStreams.map((s) => [s.plaidStreamId, s]),
    );

    for (const stream of allStreams) {
      const ourAccountId = accountMap.get(stream.account_id);
      if (!ourAccountId) continue;

      syncedStreamIds.push(stream.stream_id);
      const streamType = inflow_streams.includes(stream) ? "INFLOW" : "OUTFLOW";

      const streamData = {
        accountId: ourAccountId,
        merchantName: stream.merchant_name || null,
        description: stream.description,
        category: stream.personal_finance_category?.primary || null,
        subcategory: stream.personal_finance_category?.detailed || null,
        firstDate: new Date(stream.first_date),
        lastDate: new Date(stream.last_date),
        lastAmount: stream.last_amount.amount ?? 0,
        averageAmount: stream.average_amount.amount ?? 0,
        predictedNextDate: stream.predicted_next_date
          ? new Date(stream.predicted_next_date)
          : null,
        frequency: String(stream.frequency),
        isActive: stream.is_active,
        status: String(stream.status),
        streamType,
        currency: stream.last_amount.iso_currency_code || "USD",
      };

      const existing = existingMap.get(stream.stream_id);

      await prisma.recurringStream.upsert({
        where: { plaidStreamId: stream.stream_id },
        update: {
          ...streamData,
          cancelledByUser: existing?.cancelledByUser ?? false,
          cancelledAt: existing?.cancelledAt ?? null,
        },
        create: {
          plaidStreamId: stream.stream_id,
          ...streamData,
        },
      });
    }

    const syncedAccountIds = [...accountMap.values()];

    // Remove streams Plaid no longer returns (keep user-cancelled ones)
    if (syncedAccountIds.length > 0 && syncedStreamIds.length > 0) {
      await prisma.recurringStream.deleteMany({
        where: {
          accountId: { in: syncedAccountIds },
          plaidStreamId: { notIn: syncedStreamIds },
          cancelledByUser: false,
        },
      });
    }

    const txnIdsByStream = new Map<string, { plaidTxnIds: string[]; frequency: string }>();

    for (const stream of allStreams) {
      if (!stream.is_active) continue;
      const entry = txnIdsByStream.get(stream.stream_id) ?? {
        plaidTxnIds: [],
        frequency: String(stream.frequency),
      };
      for (const txnId of stream.transaction_ids) {
        entry.plaidTxnIds.push(txnId);
      }
      txnIdsByStream.set(stream.stream_id, entry);
    }

    if (txnIdsByStream.size > 0) {
      await prisma.transaction.updateMany({
        where: { accountId: { in: syncedAccountIds } },
        data: {
          isRecurring: false,
          recurringStreamId: null,
          recurringFrequency: null,
        },
      });

      // Mark identified transactions as recurring (one batch per stream)
      for (const [streamId, { plaidTxnIds, frequency }] of txnIdsByStream) {
        await prisma.transaction.updateMany({
          where: { plaidTransactionId: { in: plaidTxnIds } },
          data: {
            isRecurring: true,
            recurringStreamId: streamId,
            recurringFrequency: frequency,
          },
        });
      }
    }

    return true;
  } catch (error) {
    logPlaidError("sync/recurring (non-fatal)", error);
    return false;
  }
}
