import {
  User,
  Palette,
  SlidersHorizontal,
  Landmark,
  Shield,
  Bell,
  Database,
} from "lucide-react";

// --- Settings Category Definitions ---
// Each category appears in the settings sidebar/nav.
export const settingsCategories = [
  {
    id: "profile" as const,
    label: "Profile",
    description: "Your account information",
    icon: User,
  },
  {
    id: "appearance" as const,
    label: "Appearance",
    description: "Theme and visual preferences",
    icon: Palette,
  },
  {
    id: "preferences" as const,
    label: "Preferences",
    description: "Currency and date formats",
    icon: SlidersHorizontal,
  },
  {
    id: "linked-accounts" as const,
    label: "Linked Accounts",
    description: "Manage bank connections",
    icon: Landmark,
  },
  {
    id: "security" as const,
    label: "Security",
    description: "Password and account safety",
    icon: Shield,
  },
  {
    id: "notifications" as const,
    label: "Notifications",
    description: "Alert and email preferences",
    icon: Bell,
  },
  {
    id: "data-privacy" as const,
    label: "Data & Privacy",
    description: "Export data and manage account",
    icon: Database,
  },
];

export type SettingsCategory = (typeof settingsCategories)[number]["id"];

// --- Searchable Settings Registry ---
// Each entry maps to an individual setting in the UI.
// The search feature filters this array by label + description + keywords.
export type SettingsEntry = {
  id: string;
  category: SettingsCategory;
  label: string;
  description: string;
  keywords: string[];
};

export const settingsRegistry: SettingsEntry[] = [
  // Profile
  {
    id: "profile-name",
    category: "profile",
    label: "Display Name",
    description: "Change your display name",
    keywords: ["name", "username", "display", "first", "last"],
  },
  {
    id: "profile-email",
    category: "profile",
    label: "Email Address",
    description: "Your account email",
    keywords: ["email", "address", "contact"],
  },

  // Appearance
  {
    id: "appearance-accent",
    category: "appearance",
    label: "Accent Color",
    description: "Change the app's accent color theme",
    keywords: ["color", "theme", "hue", "cyan", "purple", "teal", "accent", "blue", "pink"],
  },
  {
    id: "appearance-theme",
    category: "appearance",
    label: "Theme Mode",
    description: "Switch between dark and light mode",
    keywords: ["dark", "light", "mode", "theme"],
  },

  // Preferences
  {
    id: "preferences-currency",
    category: "preferences",
    label: "Currency",
    description: "Default currency for displaying amounts",
    keywords: ["currency", "money", "dollar", "euro", "usd", "format"],
  },
  {
    id: "preferences-date",
    category: "preferences",
    label: "Date Format",
    description: "How dates are displayed throughout the app",
    keywords: ["date", "format", "time", "display"],
  },

  // Linked Accounts
  {
    id: "linked-accounts-manage",
    category: "linked-accounts",
    label: "Manage Banks",
    description: "View and manage connected bank accounts",
    keywords: ["bank", "plaid", "connect", "link", "unlink", "account"],
  },

  // Security
  {
    id: "security-password",
    category: "security",
    label: "Change Password",
    description: "Update your account password",
    keywords: ["password", "change", "security", "login"],
  },

  // Notifications
  {
    id: "notifications-email",
    category: "notifications",
    label: "Email Alerts",
    description: "Enable or disable email notifications",
    keywords: ["email", "alert", "notification", "notify"],
  },
  {
    id: "notifications-spending",
    category: "notifications",
    label: "Spending Alerts",
    description: "Get notified for large transactions",
    keywords: ["spending", "transaction", "alert", "threshold", "limit"],
  },
  {
    id: "notifications-balance",
    category: "notifications",
    label: "Low Balance Alert",
    description: "Alert when account balance drops below a threshold",
    keywords: ["balance", "low", "alert", "threshold", "minimum"],
  },
  {
    id: "notifications-digest",
    category: "notifications",
    label: "Weekly Digest",
    description: "Receive a weekly summary email",
    keywords: ["weekly", "digest", "summary", "email", "report"],
  },

  // Data & Privacy
  {
    id: "data-export",
    category: "data-privacy",
    label: "Export Data",
    description: "Download all your data as JSON",
    keywords: ["export", "download", "data", "backup", "json"],
  },
  {
    id: "data-delete",
    category: "data-privacy",
    label: "Delete Account",
    description: "Permanently delete your account and all data",
    keywords: ["delete", "remove", "account", "permanent", "close"],
  },
];
