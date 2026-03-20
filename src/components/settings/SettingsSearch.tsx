"use client";

import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

interface SettingsSearchProps {
  value: string;
  onChange: (value: string) => void;
  resultCount: number | null; // null = not searching
}

export default function SettingsSearch({
  value,
  onChange,
  resultCount,
}: SettingsSearchProps) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="text"
        placeholder="Search settings..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-9 pr-9"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
      {resultCount !== null && (
        <p className="mt-2 text-xs text-muted-foreground">
          {resultCount === 0
            ? "No matching settings"
            : `Showing ${resultCount} matching section${resultCount !== 1 ? "s" : ""}`}
        </p>
      )}
    </div>
  );
}
