export interface WeeklyDigestData {
  userName: string | null;
  periodStart: string; // ISO date
  periodEnd: string; // ISO date
  totalSpending: number;
  previousWeekSpending: number;
  spendingChange: number; // percentage
  topCategories: { category: string; total: number }[];
  upcomingRecurring: { name: string; amount: number; date: string }[];
  budgetStatus: {
    category: string;
    spent: number;
    limit: number;
    percentage: number;
  }[];
  accountSummary: { name: string; type: string; balance: number }[];
  alertCount: number;
}
