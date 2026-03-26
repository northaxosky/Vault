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

## Features — Subscriptions & Bills

- [x] **Subscriptions page** (`/dashboard/subscriptions`) — all detected recurring charges, total monthly cost, mark as cancelled
- [x] **Bill calendar** — calendar view of upcoming recurring bills with projected dates and amounts
- [x] **Recurring transaction management** — edit subscription details (custom name, expected amount, frequency override), delete subscriptions, visual indicators for paused subscriptions, toast notifications for all actions

## Features — Goals & Planning

- [x] **Savings goals** — set target amounts with deadlines, link to an account, track progress with visual milestones
- [x] **Cash flow forecast** — project future balances based on recurring income vs recurring expenses
- [x] **Debt payoff tracker** — track credit/loan payoff with snowball vs avalanche strategy comparison

## Features — Insights & Reports

- [x] **Monthly financial report** — auto-generated summary: income vs spending, top merchants, budget performance, net worth change
- [x] **Spending insights** — anomaly detection (unusual charges), month-over-month comparisons, "you spent X% more on Y this month"
- [x] **Year in review** — annual summary with top categories, biggest expenses, net worth growth
- [x] **Analytics dashboard** (`/dashboard/analytics`) — comprehensive spending trends with 24-month history, date range filters, category/account filters, charts (line trends, pie breakdown, monthly bar chart, top merchants), and key metrics (total, avg, MoM %, transaction count)

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
- [x] **Fidelity portfolio CSV parser** — parse positions export into typed holdings (multi-account, cash positions, security type inference)
- [x] **Portfolio import API** (`/api/import/portfolio`) — upload Fidelity CSV, auto-create manual institutions/accounts, upsert securities + holdings

## Features — Notifications

- [x] **Smart alerts** — large transaction warnings, budget overspend, low balance (in-app bell + toast via sonner)
- [ ] Wire up existing email notification settings to actually send

## Testing

- [x] **CSV fixture tests** (`csv-fixture-tests`) — fixture-based parser tests for First Tech, Amex, and Fidelity formats with format detection, sign-flipping, category mapping, and graceful wrong-file-type handling (25 tests)
- [x] **Portfolio parser tests** (`portfolio-parser-tests`) — unit tests for Fidelity portfolio CSV parser: format detection, equity/cash/skipped row parsing, account grouping, amount parsing, security type inference, empty/invalid input, inline CSV edge cases (55 tests)
- [x] **Portfolio API tests** (`portfolio-api-tests`) — integration tests for portfolio import API: GET support check, POST auth/demo/validation guards, valid Fidelity CSV summary (accounts, positions, cash, totalValue), Security upsert with ticker/name/type, InvestmentHolding upsert with quantity/costBasis/currentValue (11 tests)

## Improvements

- [x] Favicon: accent-colored background with vault icon
- [x] Charts with Recharts (spending by category on dashboard, trend area chart)
- [x] Loading skeletons for all async dashboard pages
- [x] Mobile responsive polish (flex-col layout, text truncation, shrink-0)
- [x] Middleware-based route protection (replace per-layout auth checks)
- [x] **Command palette** (Cmd+K / Ctrl+K) — global search across transactions, accounts, pages
- [x] **Transaction detail drawer** — click a transaction to see full details, add notes, override category
- [x] **Custom transaction rules** — auto-rename or re-categorize transactions matching a pattern (retroactive + during sync)

## Known Issues

- [ ] Plaid double-script warning in dev (React Strict Mode, harmless)
- [ ] `url.parse()` deprecation warning from dependency (not actionable)

---

Last updated: 2026-03-22 (Analytics dashboard and recurring transaction management completed)
