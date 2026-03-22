-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "isRecurring" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "recurringFrequency" TEXT,
ADD COLUMN     "recurringStreamId" TEXT;
