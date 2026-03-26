"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Upload } from "lucide-react";
import PlaidLink from "@/components/PlaidLink";

interface BankActionDropdownProps {
  onLinkSuccess?: () => void;
  onImportCsv: () => void;
  isDemo?: boolean;
}

export default function BankActionDropdown({
  onLinkSuccess,
  onImportCsv,
  isDemo = false,
}: BankActionDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative flex items-center">
      {/* Main button: Plaid Link (rounded-r-none to merge with caret) */}
      <PlaidLink
        onLinkSuccess={onLinkSuccess}
        isDemo={isDemo}
        className="glow rounded-l-lg rounded-r-none bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/80 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50"
      />

      {/* Caret dropdown trigger */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="ml-px flex items-center rounded-r-lg border border-l-0 border-primary/30 bg-primary px-1.5 py-2 text-primary-foreground transition-colors hover:bg-primary/80 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
        aria-label="More bank actions"
        aria-expanded={open}
      >
        <ChevronDown className="h-4 w-4" />
      </button>

      {/* Dropdown menu */}
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded-lg border border-border bg-popover p-1 shadow-lg">
          <button
            onClick={() => {
              setOpen(false);
              onImportCsv();
            }}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent"
          >
            <Upload className="h-4 w-4" />
            Import CSV
          </button>
        </div>
      )}
    </div>
  );
}
