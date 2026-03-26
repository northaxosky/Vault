-- AlterTable
ALTER TABLE "PlaidItem" ADD COLUMN     "isManual" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "importBatchId" TEXT;
