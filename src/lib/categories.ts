import {
  Film,
  UtensilsCrossed,
  ShoppingBag,
  DollarSign,
  Heart,
  Home,
  ArrowUpRight,
  Car,
  Plane,
  CircleDot,
  type LucideIcon,
} from "lucide-react";

// --- Category config ---
// Maps Plaid's personal_finance_category primary values to display labels and icons.

export const CATEGORY_CONFIG: Record<string, { label: string; icon: LucideIcon }> = {
  ENTERTAINMENT: { label: "Entertainment", icon: Film },
  FOOD_AND_DRINK: { label: "Food & Drink", icon: UtensilsCrossed },
  GENERAL_MERCHANDISE: { label: "General Merchandise", icon: ShoppingBag },
  INCOME: { label: "Income", icon: DollarSign },
  PERSONAL_CARE: { label: "Personal Care", icon: Heart },
  RENT_AND_UTILITIES: { label: "Rent & Utilities", icon: Home },
  TRANSFER_OUT: { label: "Transfer Out", icon: ArrowUpRight },
  TRANSPORTATION: { label: "Transportation", icon: Car },
  TRAVEL: { label: "Travel", icon: Plane },
};

export function getCategoryLabel(category: string | null): string {
  if (!category) return "Uncategorized";
  return CATEGORY_CONFIG[category]?.label ?? category;
}

export function getCategoryIcon(category: string | null): LucideIcon {
  if (!category) return CircleDot;
  return CATEGORY_CONFIG[category]?.icon ?? CircleDot;
}

// --- Currency formatting ---

export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

// --- Frequency formatting ---

export function formatFrequency(freq: string | null): string {
  switch (freq) {
    case "WEEKLY": return "Weekly";
    case "BIWEEKLY": return "Biweekly";
    case "SEMI_MONTHLY": return "Semi-monthly";
    case "MONTHLY": return "Monthly";
    case "ANNUALLY": return "Annual";
    default: return "Recurring";
  }
}
