"use client";

import type { SettingsCategory } from "@/lib/settings-registry";
import type { LucideIcon } from "lucide-react";

interface CategoryInfo {
  id: SettingsCategory;
  label: string;
  description: string;
  icon: LucideIcon;
}

interface SettingsNavProps {
  categories: CategoryInfo[];
  activeCategory: SettingsCategory;
  onSelect: (category: SettingsCategory) => void;
}

export default function SettingsNav({
  categories,
  activeCategory,
  onSelect,
}: SettingsNavProps) {
  return (
    <nav className="space-y-1">
      {categories.map((cat) => {
        const isActive = activeCategory === cat.id;

        return (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
              isActive
                ? "bg-accent text-accent-foreground border-l-2 border-primary"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            }`}
          >
            <cat.icon className="h-4 w-4 shrink-0" />
            {cat.label}
          </button>
        );
      })}
    </nav>
  );
}
