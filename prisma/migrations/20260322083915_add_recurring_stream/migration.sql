-- CreateTable
CREATE TABLE "RecurringStream" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "plaidStreamId" TEXT NOT NULL,
    "merchantName" TEXT,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "subcategory" TEXT,
    "firstDate" TIMESTAMP(3) NOT NULL,
    "lastDate" TIMESTAMP(3) NOT NULL,
    "lastAmount" DECIMAL(65,30) NOT NULL,
    "averageAmount" DECIMAL(65,30) NOT NULL,
    "predictedNextDate" TIMESTAMP(3),
    "frequency" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL,
    "streamType" TEXT NOT NULL DEFAULT 'OUTFLOW',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "cancelledByUser" BOOLEAN NOT NULL DEFAULT false,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringStream_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecurringStream_plaidStreamId_key" ON "RecurringStream"("plaidStreamId");

-- AddForeignKey
ALTER TABLE "RecurringStream" ADD CONSTRAINT "RecurringStream_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
