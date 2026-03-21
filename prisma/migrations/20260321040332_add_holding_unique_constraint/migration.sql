-- CreateIndex
CREATE UNIQUE INDEX "InvestmentHolding_accountId_securityId_key" ON "InvestmentHolding"("accountId", "securityId");
