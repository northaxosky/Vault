# Vault — TODO

> Track features, improvements, and known issues.
> Mark items with `[x]` when complete.

---

## In Progress

(none)

## Features — Core Pages

- [x] **Dashboard home** — summary cards (net worth, cash, credit), linked accounts grouped by institution
- [x] **Transactions page** (`/dashboard/transactions`) — searchable/filterable transaction list with category icons and date grouping
- [x] **Accounts page** (`/dashboard/accounts`) — accounts grouped by institution with type filtering, subtypes, balances, and transaction counts
- [x] **Investments page** (`/dashboard/investments`) — holdings grouped by account, summary cards (portfolio value, cost basis, gain/loss), ticker badges, security types
- [x] **Budgets page** (`/dashboard/budgets`) — per-category monthly budgets with progress bars, color-coded thresholds, CRUD management
- [x] Dashboard: recent transactions section with category icons and "View all" link
- [x] Dashboard: spending-by-category donut chart (Recharts)
- [x] Dashboard: tabbed trend chart (spending/income/cash flow/net worth over time, AreaChart with time-range toggles)
- [x] Dashboard: balance snapshots for historical net worth chart tab

## Features — Settings

- [x] Light mode theme toggle (cookie-based, instant switch, no page reload)
- [ ] Email notification sending (UI is built, backend delivery not wired)
- [ ] Weekly digest email

## Features — Auth & Security

- [ ] Google OAuth provider (NextAuth config)
- [ ] Email verification flow
- [ ] Password reset / forgot password

## Features — Data & Integrations

- [x] Plaid transaction sync (cursor-based, auto-sync on dashboard load, manual Sync button)
- [x] Plaid sync after linking (PlaidLink triggers sync automatically)
- [x] Plaid investment holdings sync (snapshot-based, upsert securities + holdings, stale cleanup)
- [x] Recurring transaction detection (Plaid streams, badges, "Recurring only" filter)
- [x] Budget / spending categories (CRUD API, budgets page, sidebar nav)

## Improvements

- [x] Favicon: accent-colored background with vault icon
- [x] Charts with Recharts (spending by category on dashboard, trend area chart)
- [x] Loading skeletons for all async dashboard pages
- [x] Mobile responsive polish (flex-col layout, text truncation, shrink-0)
- [x] Middleware-based route protection (replace per-layout auth checks)

## Known Issues

- [ ] Plaid double-script warning in dev (React Strict Mode, harmless)
- [ ] `url.parse()` deprecation warning from dependency (not actionable)

---

Last updated: 2026-03-22
