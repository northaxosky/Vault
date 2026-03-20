"use client";

import { useState, useMemo } from "react";
import { settingsCategories, settingsRegistry } from "@/lib/settings-registry";
import type { SettingsCategory } from "@/lib/settings-registry";
import SettingsSearch from "./SettingsSearch";
import SettingsNav from "./SettingsNav";
import ProfileSettings from "./ProfileSettings";
import AppearanceSettings from "./AppearanceSettings";
import PreferenceSettings from "./PreferenceSettings";
import LinkedAccountsSettings from "./LinkedAccountsSettings";
import SecuritySettings from "./SecuritySettings";
import NotificationSettings from "./NotificationSettings";
import DataPrivacySettings from "./DataPrivacySettings";

interface UserSettings {
  accentHue: number;
  currency: string;
  dateFormat: string;
  emailAlerts: boolean;
  spendingAlert: number | null;
  lowBalanceAlert: number | null;
  weeklyDigest: boolean;
}

interface LinkedAccount {
  id: string;
  institutionName: string | null;
  createdAt: string;
  accounts: { id: string; name: string; type: string; subtype: string | null }[];
}

interface SettingsClientProps {
  userName: string | null;
  userEmail: string;
  userCreatedAt: string;
  settings: UserSettings;
  linkedAccounts: LinkedAccount[];
}

export default function SettingsClient({
  userName,
  userEmail,
  userCreatedAt,
  settings,
  linkedAccounts,
}: SettingsClientProps) {
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>("profile");
  const [searchQuery, setSearchQuery] = useState("");

  // Filter settings registry based on search query
  const matchingCategories = useMemo(() => {
    if (!searchQuery.trim()) return null; // null = show all normally

    const query = searchQuery.toLowerCase();
    const matchingEntries = settingsRegistry.filter((entry) => {
      const searchable = `${entry.label} ${entry.description} ${entry.keywords.join(" ")}`;
      return searchable.toLowerCase().includes(query);
    });

    // Get unique categories that have matching entries
    return [...new Set(matchingEntries.map((e) => e.category))];
  }, [searchQuery]);

  // When searching, show only matching categories.
  // When not searching, show the selected category.
  const categoriesToShow = matchingCategories ?? [activeCategory];

  const renderCategory = (categoryId: SettingsCategory) => {
    switch (categoryId) {
      case "profile":
        return (
          <ProfileSettings
            key="profile"
            userName={userName}
            userEmail={userEmail}
            userCreatedAt={userCreatedAt}
          />
        );
      case "appearance":
        return <AppearanceSettings key="appearance" settings={settings} />;
      case "preferences":
        return <PreferenceSettings key="preferences" settings={settings} />;
      case "linked-accounts":
        return (
          <LinkedAccountsSettings
            key="linked-accounts"
            linkedAccounts={linkedAccounts}
          />
        );
      case "security":
        return <SecuritySettings key="security" />;
      case "notifications":
        return <NotificationSettings key="notifications" settings={settings} />;
      case "data-privacy":
        return <DataPrivacySettings key="data-privacy" />;
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="text-2xl font-bold text-foreground">Settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Manage your account and preferences (Some changes require a page refresh)
      </p>

      {/* Search */}
      <div className="mt-6">
        <SettingsSearch
          value={searchQuery}
          onChange={setSearchQuery}
          resultCount={matchingCategories?.length ?? null}
        />
      </div>

      {/* Two-panel layout: nav + content */}
      <div className="mt-6 flex gap-6">
        {/* Category nav — hidden during search */}
        {!searchQuery.trim() && (
          <div className="hidden w-56 shrink-0 md:block">
            <SettingsNav
              categories={settingsCategories}
              activeCategory={activeCategory}
              onSelect={setActiveCategory}
            />
          </div>
        )}

        {/* Mobile category nav — horizontal scrollable */}
        {!searchQuery.trim() && (
          <div className="mb-4 flex gap-2 overflow-x-auto pb-2 md:hidden">
            {settingsCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs transition-colors ${
                  activeCategory === cat.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        )}

        {/* Content area */}
        <div className="flex-1 space-y-6">
          {categoriesToShow.length === 0 ? (
            <div className="glass rounded-xl p-8 text-center">
              <p className="text-muted-foreground">
                No settings match &quot;{searchQuery}&quot;
              </p>
            </div>
          ) : (
            categoriesToShow.map((categoryId) => (
              <div key={categoryId}>
                {/* Show category header when searching (multiple categories visible) */}
                {matchingCategories && matchingCategories.length > 1 && (
                  <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
                    {settingsCategories.find((c) => c.id === categoryId)?.label}
                  </h2>
                )}
                {renderCategory(categoryId)}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
