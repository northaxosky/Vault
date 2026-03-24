-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN     "dashboardWidgets" TEXT NOT NULL DEFAULT '["credit-score","upcoming-bills","savings-goals","budget-overview","debt-summary"]';
