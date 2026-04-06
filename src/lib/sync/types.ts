import type { PrismaClient, TransactionRule } from "@/generated/prisma/client";

/** Map from Plaid account_id to our internal Account.id */
export type AccountMap = Map<string, string>;

/** Shared context threaded through every sync sub-module */
export interface SyncContext {
  prisma: PrismaClient;
  userId: string;
  accessToken: string;
  plaidItemId: string;
  cursor: string;
  accountMap: AccountMap;
  rules: TransactionRule[];
}

/** Accumulated counts returned by the transaction sync loop */
export interface TransactionSyncResult {
  added: number;
  modified: number;
  removed: number;
}

/** Result from processing a single PlaidItem */
export interface ItemSyncResult {
  itemId: string;
  transactions: TransactionSyncResult;
  recurringOk: boolean;
  investmentsOk: boolean;
  error?: string;
}

/** Alert data before insertion */
export interface PendingAlert {
  userId: string;
  type: string;
  title: string;
  message: string;
  transactionId?: string;
}
