export const DASHBOARD_WIDGETS = [
  { id: "credit-score", label: "Credit Score", description: "Estimated credit score based on your financial data" },
  { id: "upcoming-bills", label: "Upcoming Bills", description: "Recurring charges due in the next 14 days" },
  { id: "savings-goals", label: "Savings Goals", description: "Progress toward your savings targets" },
  { id: "budget-overview", label: "Budget Overview", description: "This month's budget status by category" },
  { id: "debt-summary", label: "Debt Summary", description: "Outstanding debts and interest rates" },
  { id: "activity-heatmap", label: "Activity", description: "Daily transaction activity over the past 3 months" },
] as const;

export type WidgetId = (typeof DASHBOARD_WIDGETS)[number]["id"];

export const DEFAULT_WIDGETS: WidgetId[] = DASHBOARD_WIDGETS.map((w) => w.id);

export function parseWidgets(json: string | null | undefined): WidgetId[] {
  if (!json) return DEFAULT_WIDGETS;
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return DEFAULT_WIDGETS;
    return parsed.filter((id: string) =>
      DASHBOARD_WIDGETS.some((w) => w.id === id)
    );
  } catch {
    return DEFAULT_WIDGETS;
  }
}
