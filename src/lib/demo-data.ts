import type { TransactionData } from "./types";

// ---------------------------------------------------------------------------
// Helpers — dates relative to "now" so demo data always looks fresh
// ---------------------------------------------------------------------------

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

function dateKey(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Local type definitions for demo data shapes
// ---------------------------------------------------------------------------

export interface AccountData {
  id: string;
  name: string;
  officialName: string | null;
  type: string;
  subtype: string | null;
  currentBalance: number | null;
  availableBalance: number | null;
  currency: string;
}

export interface InstitutionData {
  id: string;
  institutionName: string;
  createdAt: string;
  accounts: AccountData[];
}

export interface CategorySpending {
  category: string;
  total: number;
}

export interface DailyTrendData {
  date: string;
  spending: number;
  income: number;
  cashFlow: number;
  netWorth: number | null;
}

export interface BudgetData {
  category: string;
  label: string;
  spent: number;
  limit: number;
  percentage: number;
}

export interface SavingsGoalData {
  name: string;
  target: number;
  current: number;
  percentage: number;
  deadline: string | null;
}

export interface DebtData {
  name: string;
  balance: number;
  interestRate: number;
  minimumPayment: number;
}

export interface RecurringBillData {
  name: string;
  amount: number;
  date: string;
  frequency: string;
}

export interface CreditScoreFactorData {
  label: string;
  impact: string;
  detail: string;
}

export interface CreditScoreData {
  score: number;
  rating: string;
  factors: CreditScoreFactorData[];
}

// ---------------------------------------------------------------------------
// Demo User
// ---------------------------------------------------------------------------

export const DEMO_USER = {
  id: "demo-user-001",
  name: "Alex Demo",
  email: "alex@demo.vault.app",
  emailVerified: true,
};

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export const DEMO_ACCOUNTS: AccountData[] = [
  {
    id: "acc-1",
    name: "Chase Checking",
    officialName: "Chase Total Checking",
    type: "depository",
    subtype: "checking",
    currentBalance: 4523.67,
    availableBalance: 4423.67,
    currency: "USD",
  },
  {
    id: "acc-2",
    name: "Ally Savings",
    officialName: "Ally Online Savings Account",
    type: "depository",
    subtype: "savings",
    currentBalance: 12850.0,
    availableBalance: 12850.0,
    currency: "USD",
  },
  {
    id: "acc-3",
    name: "Chase Sapphire",
    officialName: "Chase Sapphire Preferred Credit Card",
    type: "credit",
    subtype: "credit card",
    currentBalance: 1247.33,
    availableBalance: 8752.67,
    currency: "USD",
  },
  {
    id: "acc-4",
    name: "Fidelity 401k",
    officialName: "Fidelity Investments 401(k)",
    type: "investment",
    subtype: "401k",
    currentBalance: 34200.0,
    availableBalance: null,
    currency: "USD",
  },
];

// ---------------------------------------------------------------------------
// Institutions
// ---------------------------------------------------------------------------

export const DEMO_INSTITUTIONS: InstitutionData[] = [
  {
    id: "inst-1",
    institutionName: "Chase",
    createdAt: daysAgo(180),
    accounts: [DEMO_ACCOUNTS[0], DEMO_ACCOUNTS[2]],
  },
  {
    id: "inst-2",
    institutionName: "Ally Bank",
    createdAt: daysAgo(150),
    accounts: [DEMO_ACCOUNTS[1]],
  },
  {
    id: "inst-3",
    institutionName: "Fidelity",
    createdAt: daysAgo(120),
    accounts: [DEMO_ACCOUNTS[3]],
  },
];

// ---------------------------------------------------------------------------
// Transactions — 35 realistic transactions over the last 30 days
// ---------------------------------------------------------------------------

export const DEMO_TRANSACTIONS: TransactionData[] = [
  // --- Income ---
  { id: "txn-01", name: "Payroll Direct Deposit", merchantName: "ACME Corp", amount: -3250.00, date: daysAgo(1), category: "INCOME", subcategory: "WAGES", pending: false, isRecurring: true, recurringFrequency: "BIWEEKLY", currency: "USD", accountName: "Chase Checking", notes: null, userCategory: null },
  { id: "txn-02", name: "Payroll Direct Deposit", merchantName: "ACME Corp", amount: -3250.00, date: daysAgo(15), category: "INCOME", subcategory: "WAGES", pending: false, isRecurring: true, recurringFrequency: "BIWEEKLY", currency: "USD", accountName: "Chase Checking", notes: null, userCategory: null },

  // --- Rent & Utilities ---
  { id: "txn-03", name: "Rent Payment", merchantName: null, amount: 1800.00, date: daysAgo(2), category: "RENT_AND_UTILITIES", subcategory: "RENT", pending: false, isRecurring: true, recurringFrequency: "MONTHLY", currency: "USD", accountName: "Chase Checking", notes: null, userCategory: null },
  { id: "txn-04", name: "Electric Bill", merchantName: "ConEdison", amount: 95.40, date: daysAgo(5), category: "RENT_AND_UTILITIES", subcategory: "ELECTRICITY", pending: false, isRecurring: true, recurringFrequency: "MONTHLY", currency: "USD", accountName: "Chase Checking", notes: null, userCategory: null },
  { id: "txn-05", name: "Internet Service", merchantName: "Verizon Fios", amount: 79.99, date: daysAgo(8), category: "RENT_AND_UTILITIES", subcategory: "INTERNET", pending: false, isRecurring: true, recurringFrequency: "MONTHLY", currency: "USD", accountName: "Chase Checking", notes: null, userCategory: null },

  // --- Food & Drink ---
  { id: "txn-06", name: "Whole Foods Market", merchantName: "Whole Foods", amount: 87.32, date: daysAgo(1), category: "FOOD_AND_DRINK", subcategory: "GROCERIES", pending: false, isRecurring: false, recurringFrequency: null, currency: "USD", accountName: "Chase Sapphire", notes: null, userCategory: null },
  { id: "txn-07", name: "Trader Joe's", merchantName: "Trader Joe's", amount: 62.15, date: daysAgo(4), category: "FOOD_AND_DRINK", subcategory: "GROCERIES", pending: false, isRecurring: false, recurringFrequency: null, currency: "USD", accountName: "Chase Sapphire", notes: null, userCategory: null },
  { id: "txn-08", name: "Chipotle Mexican Grill", merchantName: "Chipotle", amount: 14.25, date: daysAgo(2), category: "FOOD_AND_DRINK", subcategory: "RESTAURANT", pending: false, isRecurring: false, recurringFrequency: null, currency: "USD", accountName: "Chase Sapphire", notes: null, userCategory: null },
  { id: "txn-09", name: "Starbucks", merchantName: "Starbucks", amount: 6.45, date: daysAgo(3), category: "FOOD_AND_DRINK", subcategory: "COFFEE", pending: false, isRecurring: false, recurringFrequency: null, currency: "USD", accountName: "Chase Sapphire", notes: null, userCategory: null },
  { id: "txn-10", name: "DoorDash", merchantName: "DoorDash", amount: 34.50, date: daysAgo(6), category: "FOOD_AND_DRINK", subcategory: "RESTAURANT", pending: false, isRecurring: false, recurringFrequency: null, currency: "USD", accountName: "Chase Sapphire", notes: null, userCategory: null },
  { id: "txn-11", name: "Kroger", merchantName: "Kroger", amount: 53.20, date: daysAgo(9), category: "FOOD_AND_DRINK", subcategory: "GROCERIES", pending: false, isRecurring: false, recurringFrequency: null, currency: "USD", accountName: "Chase Sapphire", notes: null, userCategory: null },
  { id: "txn-12", name: "Olive Garden", merchantName: "Olive Garden", amount: 56.80, date: daysAgo(11), category: "FOOD_AND_DRINK", subcategory: "RESTAURANT", pending: false, isRecurring: false, recurringFrequency: null, currency: "USD", accountName: "Chase Sapphire", notes: null, userCategory: null },
  { id: "txn-13", name: "Whole Foods Market", merchantName: "Whole Foods", amount: 94.17, date: daysAgo(14), category: "FOOD_AND_DRINK", subcategory: "GROCERIES", pending: false, isRecurring: false, recurringFrequency: null, currency: "USD", accountName: "Chase Sapphire", notes: null, userCategory: null },
  { id: "txn-14", name: "Panera Bread", merchantName: "Panera Bread", amount: 12.99, date: daysAgo(17), category: "FOOD_AND_DRINK", subcategory: "RESTAURANT", pending: false, isRecurring: false, recurringFrequency: null, currency: "USD", accountName: "Chase Sapphire", notes: null, userCategory: null },
  { id: "txn-15", name: "Trader Joe's", merchantName: "Trader Joe's", amount: 71.45, date: daysAgo(20), category: "FOOD_AND_DRINK", subcategory: "GROCERIES", pending: false, isRecurring: false, recurringFrequency: null, currency: "USD", accountName: "Chase Sapphire", notes: null, userCategory: null },

  // --- Transportation ---
  { id: "txn-16", name: "Shell Gas Station", merchantName: "Shell", amount: 48.75, date: daysAgo(3), category: "TRANSPORTATION", subcategory: "GAS", pending: false, isRecurring: false, recurringFrequency: null, currency: "USD", accountName: "Chase Sapphire", notes: null, userCategory: null },
  { id: "txn-17", name: "Uber", merchantName: "Uber", amount: 22.30, date: daysAgo(7), category: "TRANSPORTATION", subcategory: "RIDE_SHARE", pending: false, isRecurring: false, recurringFrequency: null, currency: "USD", accountName: "Chase Sapphire", notes: null, userCategory: null },
  { id: "txn-18", name: "BP Gas Station", merchantName: "BP", amount: 52.10, date: daysAgo(16), category: "TRANSPORTATION", subcategory: "GAS", pending: false, isRecurring: false, recurringFrequency: null, currency: "USD", accountName: "Chase Sapphire", notes: null, userCategory: null },

  // --- Entertainment ---
  { id: "txn-19", name: "Netflix", merchantName: "Netflix", amount: 15.99, date: daysAgo(4), category: "ENTERTAINMENT", subcategory: "STREAMING", pending: false, isRecurring: true, recurringFrequency: "MONTHLY", currency: "USD", accountName: "Chase Sapphire", notes: null, userCategory: null },
  { id: "txn-20", name: "Spotify Premium", merchantName: "Spotify", amount: 10.99, date: daysAgo(6), category: "ENTERTAINMENT", subcategory: "STREAMING", pending: false, isRecurring: true, recurringFrequency: "MONTHLY", currency: "USD", accountName: "Chase Sapphire", notes: null, userCategory: null },
  { id: "txn-21", name: "AMC Theatres", merchantName: "AMC Theatres", amount: 28.00, date: daysAgo(10), category: "ENTERTAINMENT", subcategory: "MOVIES", pending: false, isRecurring: false, recurringFrequency: null, currency: "USD", accountName: "Chase Sapphire", notes: null, userCategory: null },

  // --- General Merchandise / Shopping ---
  { id: "txn-22", name: "Amazon.com", merchantName: "Amazon", amount: 45.99, date: daysAgo(2), category: "GENERAL_MERCHANDISE", subcategory: "ONLINE_SHOPPING", pending: true, isRecurring: false, recurringFrequency: null, currency: "USD", accountName: "Chase Sapphire", notes: null, userCategory: null },
  { id: "txn-23", name: "Target", merchantName: "Target", amount: 67.84, date: daysAgo(8), category: "GENERAL_MERCHANDISE", subcategory: "DEPARTMENT_STORE", pending: false, isRecurring: false, recurringFrequency: null, currency: "USD", accountName: "Chase Sapphire", notes: null, userCategory: null },
  { id: "txn-24", name: "Amazon.com", merchantName: "Amazon", amount: 29.99, date: daysAgo(13), category: "GENERAL_MERCHANDISE", subcategory: "ONLINE_SHOPPING", pending: false, isRecurring: false, recurringFrequency: null, currency: "USD", accountName: "Chase Sapphire", notes: null, userCategory: null },
  { id: "txn-25", name: "Best Buy", merchantName: "Best Buy", amount: 149.99, date: daysAgo(22), category: "GENERAL_MERCHANDISE", subcategory: "ELECTRONICS", pending: false, isRecurring: false, recurringFrequency: null, currency: "USD", accountName: "Chase Sapphire", notes: null, userCategory: null },

  // --- Personal Care ---
  { id: "txn-26", name: "CVS Pharmacy", merchantName: "CVS", amount: 23.47, date: daysAgo(5), category: "PERSONAL_CARE", subcategory: "PHARMACY", pending: false, isRecurring: false, recurringFrequency: null, currency: "USD", accountName: "Chase Sapphire", notes: null, userCategory: null },
  { id: "txn-27", name: "Planet Fitness", merchantName: "Planet Fitness", amount: 45.00, date: daysAgo(7), category: "PERSONAL_CARE", subcategory: "GYM", pending: false, isRecurring: true, recurringFrequency: "MONTHLY", currency: "USD", accountName: "Chase Checking", notes: null, userCategory: null },

  // --- Transfer ---
  { id: "txn-28", name: "Transfer to Ally Savings", merchantName: null, amount: 500.00, date: daysAgo(1), category: "TRANSFER_OUT", subcategory: "SAVINGS", pending: false, isRecurring: true, recurringFrequency: "MONTHLY", currency: "USD", accountName: "Chase Checking", notes: null, userCategory: null },

  // --- Subscriptions (more) ---
  { id: "txn-29", name: "Car Insurance", merchantName: "GEICO", amount: 120.00, date: daysAgo(12), category: "TRANSPORTATION", subcategory: "INSURANCE", pending: false, isRecurring: true, recurringFrequency: "MONTHLY", currency: "USD", accountName: "Chase Checking", notes: null, userCategory: null },

  // --- More groceries/food scattered ---
  { id: "txn-30", name: "Costco", merchantName: "Costco", amount: 142.37, date: daysAgo(18), category: "FOOD_AND_DRINK", subcategory: "GROCERIES", pending: false, isRecurring: false, recurringFrequency: null, currency: "USD", accountName: "Chase Sapphire", notes: null, userCategory: null },
  { id: "txn-31", name: "Starbucks", merchantName: "Starbucks", amount: 5.75, date: daysAgo(19), category: "FOOD_AND_DRINK", subcategory: "COFFEE", pending: false, isRecurring: false, recurringFrequency: null, currency: "USD", accountName: "Chase Sapphire", notes: null, userCategory: null },
  { id: "txn-32", name: "Subway", merchantName: "Subway", amount: 9.85, date: daysAgo(21), category: "FOOD_AND_DRINK", subcategory: "RESTAURANT", pending: false, isRecurring: false, recurringFrequency: null, currency: "USD", accountName: "Chase Sapphire", notes: null, userCategory: null },

  // --- More misc ---
  { id: "txn-33", name: "Walgreens", merchantName: "Walgreens", amount: 18.50, date: daysAgo(23), category: "PERSONAL_CARE", subcategory: "PHARMACY", pending: false, isRecurring: false, recurringFrequency: null, currency: "USD", accountName: "Chase Sapphire", notes: null, userCategory: null },
  { id: "txn-34", name: "Shell Gas Station", merchantName: "Shell", amount: 44.20, date: daysAgo(25), category: "TRANSPORTATION", subcategory: "GAS", pending: false, isRecurring: false, recurringFrequency: null, currency: "USD", accountName: "Chase Sapphire", notes: null, userCategory: null },
  { id: "txn-35", name: "Kroger", merchantName: "Kroger", amount: 61.90, date: daysAgo(27), category: "FOOD_AND_DRINK", subcategory: "GROCERIES", pending: false, isRecurring: false, recurringFrequency: null, currency: "USD", accountName: "Chase Sapphire", notes: null, userCategory: null },
];

// ---------------------------------------------------------------------------
// Category Spending (current month)
// ---------------------------------------------------------------------------

export const DEMO_CATEGORY_SPENDING: CategorySpending[] = [
  { category: "FOOD_AND_DRINK", total: 662.87 },
  { category: "RENT_AND_UTILITIES", total: 1975.39 },
  { category: "TRANSPORTATION", total: 287.35 },
  { category: "GENERAL_MERCHANDISE", total: 293.81 },
  { category: "ENTERTAINMENT", total: 54.98 },
  { category: "PERSONAL_CARE", total: 86.97 },
  { category: "TRANSFER_OUT", total: 500.00 },
];

// ---------------------------------------------------------------------------
// Daily Trend — 30 days of spending, income, cash flow, net worth
// ---------------------------------------------------------------------------

export function generateDailyTrend(): DailyTrendData[] {
  const data: DailyTrendData[] = [];
  let netWorth = 49800;

  for (let i = 29; i >= 0; i--) {
    const dayOfWeek = new Date(
      new Date().getTime() - i * 86400000,
    ).getDay();

    // Realistic spending patterns: weekends higher, weekdays lower
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const baseSpending = isWeekend ? 120 : 75;
    const variation = Math.sin(i * 0.7) * 40 + Math.cos(i * 1.3) * 25;
    const spending = Math.round((baseSpending + variation + Math.abs(variation * 0.3)) * 100) / 100;

    // Income on the 1st and 15th (roughly days 1 and 15 ago)
    const income = i === 1 || i === 15 ? 3250 : 0;

    const cashFlow = Math.round((income - spending) * 100) / 100;
    netWorth = Math.round((netWorth + cashFlow) * 100) / 100;

    data.push({
      date: dateKey(i),
      spending,
      income,
      cashFlow,
      netWorth,
    });
  }

  return data;
}

export const DEMO_DAILY_TREND: DailyTrendData[] = generateDailyTrend();

// ---------------------------------------------------------------------------
// Budgets
// ---------------------------------------------------------------------------

export const DEMO_BUDGETS: BudgetData[] = [
  { category: "FOOD_AND_DRINK", label: "Food & Drink", spent: 662.87, limit: 800, percentage: 83 },
  { category: "ENTERTAINMENT", label: "Entertainment", spent: 54.98, limit: 150, percentage: 37 },
  { category: "GENERAL_MERCHANDISE", label: "General Merchandise", spent: 293.81, limit: 300, percentage: 98 },
  { category: "TRANSPORTATION", label: "Transportation", spent: 287.35, limit: 350, percentage: 82 },
  { category: "PERSONAL_CARE", label: "Personal Care", spent: 86.97, limit: 100, percentage: 87 },
];

// ---------------------------------------------------------------------------
// Savings Goals
// ---------------------------------------------------------------------------

export const DEMO_SAVINGS_GOALS: SavingsGoalData[] = [
  {
    name: "Emergency Fund",
    target: 20000,
    current: 8500,
    percentage: 43,
    deadline: daysFromNow(365),
  },
  {
    name: "Vacation to Japan",
    target: 3000,
    current: 1200,
    percentage: 40,
    deadline: daysFromNow(180),
  },
  {
    name: "New Laptop",
    target: 2000,
    current: 1650,
    percentage: 83,
    deadline: daysFromNow(60),
  },
];

// ---------------------------------------------------------------------------
// Debts
// ---------------------------------------------------------------------------

export const DEMO_DEBTS: DebtData[] = [
  {
    name: "Chase Sapphire Card",
    balance: 1247.33,
    interestRate: 19.99,
    minimumPayment: 35,
  },
  {
    name: "Student Loan",
    balance: 18500,
    interestRate: 5.5,
    minimumPayment: 220,
  },
];

// ---------------------------------------------------------------------------
// Recurring Bills (upcoming in next 14 days)
// ---------------------------------------------------------------------------

export const DEMO_RECURRING: RecurringBillData[] = [
  { name: "Netflix", amount: 15.99, date: daysFromNow(2), frequency: "MONTHLY" },
  { name: "Spotify Premium", amount: 10.99, date: daysFromNow(4), frequency: "MONTHLY" },
  { name: "Planet Fitness", amount: 45.00, date: daysFromNow(5), frequency: "MONTHLY" },
  { name: "Rent Payment", amount: 1800.00, date: daysFromNow(7), frequency: "MONTHLY" },
  { name: "Car Insurance (GEICO)", amount: 120.00, date: daysFromNow(10), frequency: "MONTHLY" },
  { name: "Verizon Fios", amount: 79.99, date: daysFromNow(12), frequency: "MONTHLY" },
];

// ---------------------------------------------------------------------------
// Credit Score
// ---------------------------------------------------------------------------

export const DEMO_CREDIT_SCORE: CreditScoreData = {
  score: 742,
  rating: "Very Good",
  factors: [
    { label: "Payment History", impact: "positive", detail: "Consistent on-time payments" },
    { label: "Credit Utilization", impact: "positive", detail: "12.5% utilization rate" },
    { label: "Account Age", impact: "neutral", detail: "Average age: 3.2 years" },
    { label: "Account Mix", impact: "positive", detail: "Good diversity of account types" },
    { label: "Recent Activity", impact: "neutral", detail: "Normal transaction frequency" },
  ],
};

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export const DEMO_SETTINGS = {
  id: "settings-001",
  userId: "demo-user-001",
  accentHue: 195,
  currency: "USD",
  dateFormat: "MM/DD/YYYY",
  emailAlerts: true,
  spendingAlert: 500,
  lowBalanceAlert: 100,
  weeklyDigest: true,
  dashboardWidgets:
    '["credit-score","upcoming-bills","savings-goals","budget-overview","debt-summary","activity-heatmap"]',
  createdAt: daysAgo(180),
  updatedAt: daysAgo(0),
};

// ---------------------------------------------------------------------------
// Pre-computed dashboard summary (matches dashboard page shape)
// ---------------------------------------------------------------------------

export const DEMO_SUMMARY = {
  netWorth: 50326.34, // 4523.67 + 12850 + 34200 - 1247.33
  cashTotal: 17373.67, // 4523.67 + 12850
  creditTotal: 1247.33,
  totalAccounts: 4,
};
