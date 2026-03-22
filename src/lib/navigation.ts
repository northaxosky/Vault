import {
  LayoutDashboard,
  Landmark,
  ArrowLeftRight,
  TrendingUp,
  Target,
  Repeat,
  Goal,
  LineChart,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/accounts", label: "Accounts", icon: Landmark },
  { href: "/dashboard/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/dashboard/investments", label: "Investments", icon: TrendingUp },
  { href: "/dashboard/budgets", label: "Budgets", icon: Target },
  { href: "/dashboard/subscriptions", label: "Subscriptions", icon: Repeat },
  { href: "/dashboard/goals", label: "Goals", icon: Goal },
  { href: "/dashboard/insights", label: "Insights", icon: LineChart },
];

export const settingsNavItem: NavItem = {
  href: "/dashboard/settings",
  label: "Settings",
  icon: Settings,
};
