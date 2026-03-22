# Vault — TODO

> Track features, improvements, and known issues.
> Mark items with `[x]` when complete.

---

## In Progress

- [ ] Loading skeletons for async pages

## Features — Core Pages

- [x] **Dashboard home** — summary cards (net worth, cash, credit), linked accounts grouped by institution
- [x] **Transactions page** (`/dashboard/transactions`) — searchable/filterable transaction list with category icons and date grouping
- [x] **Accounts page** (`/dashboard/accounts`) — accounts grouped by institution with type filtering, subtypes, balances, and transaction counts
- [x] **Investments page** (`/dashboard/investments`) — holdings grouped by account, summary cards (portfolio value, cost basis, gain/loss), ticker badges, security types
- [x] Dashboard: recent transactions section with category icons and "View all" link
- [x] Dashboard: spending-by-category donut chart (Recharts)

## Features — Settings

- [ ] Light mode theme toggle (currently placeholder "Coming soon")
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
- [ ] Recurring transaction detection
- [ ] Budget / spending categories

## Improvements

- [x] Favicon: accent-colored background with vault icon
- [x] Charts with Recharts (spending by category on dashboard)
- [ ] Middleware-based route protection (replace per-layout auth checks)
- [ ] Loading skeletons for async pages
- [ ] Mobile responsive polish

## Known Issues

- [ ] Plaid double-script warning in dev (React Strict Mode, harmless)
- [ ] `url.parse()` deprecation warning from dependency (not actionable)

---

Last updated: 2026-03-21
