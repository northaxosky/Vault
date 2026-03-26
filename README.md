# 🏦 Vault

> A modern personal finance dashboard — connect your banks, track spending, and gain financial insights.

![CI](https://github.com/northaxosky/Vault/actions/workflows/ci.yml/badge.svg)
![Tests](https://img.shields.io/badge/tests-79%2B%20passing-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)
![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)

## Features

- Testing
- **Banking** — Link bank accounts via Plaid, auto-sync transactions
- **Dashboard** — Net worth, cash & credit summaries, spending trends, category breakdown
- **Budgets** — Per-category monthly budgets with visual tracking
- **Savings Goals** — Track progress toward financial targets with deadlines
- **Debt Tracking** — Monitor debts, interest rates, and payments
- **Subscriptions** — Detect and track recurring charges automatically
- **Alerts** — Large transactions, low balance, budget overspend notifications
- **Weekly Digest** — Automated financial summary emails via Resend
- **Credit Score** — Estimated score based on financial health indicators
- **Analytics** — Spending trends, category breakdowns, daily patterns
- **Customizable** — Toggleable dashboard widgets, accent color theming
- **Secure** — OAuth + email/password auth, AES-256-GCM encrypted tokens, email verification

## Tech Stack

| Category | Technology |
|----------|-----------|
| Framework | [Next.js 16](https://nextjs.org/) (App Router, React 19, TypeScript) |
| Styling | [Tailwind CSS 4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) |
| Database | [PostgreSQL 17+](https://www.postgresql.org/) with [Prisma ORM 7.5](https://www.prisma.io/) |
| Auth | [NextAuth.js 5.0](https://authjs.dev/) (beta) |
| Banking | [Plaid API](https://plaid.com/) (sandbox + development) |
| Charts | [Recharts](https://recharts.org/) |
| Email | [Resend](https://resend.com/) |
| Testing | [Vitest](https://vitest.dev/) + [React Testing Library](https://testing-library.com/) |

## Screenshots

<!-- Screenshots coming soon -->

## Getting Started

### Prerequisites

- Node.js 22+
- PostgreSQL 17+
- [Plaid developer account](https://dashboard.plaid.com/signup)
- [Resend account](https://resend.com/) (for transactional email)
- Google OAuth credentials (optional, for Google sign-in)

### Installation

```bash
# Clone the repository
git clone https://github.com/northaxosky/Vault.git
cd Vault

# Install dependencies
npm install

# Copy the example env file
cp .env.example .env

# Generate the Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Environment Variables

Create a `.env` file based on `.env.example`. All variables below are required unless noted:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_URL` | App URL (e.g. `http://localhost:3000`) |
| `NEXTAUTH_SECRET` | Random secret for session encryption — generate with `openssl rand -base64 32` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID *(optional)* |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret *(optional)* |
| `PLAID_CLIENT_ID` | Plaid API client ID |
| `PLAID_SECRET` | Plaid sandbox secret |
| `PLAID_SECRET_DEVELOPMENT` | Plaid development secret *(optional)* |
| `PLAID_SECRET_PRODUCTION` | Plaid production secret *(optional)* |
| `PLAID_ENV` | Plaid environment: `sandbox`, `development`, or `production` |
| `ENCRYPTION_KEY` | AES-256 key for Plaid token encryption — generate with `openssl rand -hex 32` |
| `RESEND_API_KEY` | Resend API key for transactional email |
| `EMAIL_FROM` | Sender address (e.g. `Vault <vault@yourdomain.com>`) |

## Testing

Vault uses **Vitest** with **React Testing Library** and **jsdom** for unit and integration tests.

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

**79+ tests** covering API routes, widgets, email delivery, credit score calculations, and utility functions.

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/                # API routes (auth, plaid, budgets, widgets, etc.)
│   ├── dashboard/          # Dashboard pages (accounts, analytics, budgets, goals, etc.)
│   ├── login/              # Auth pages
│   └── layout.tsx          # Root layout
├── components/             # React components
│   ├── ui/                 # shadcn/ui primitives
│   ├── dashboard/          # Dashboard-specific widgets
│   └── settings/           # Settings panels
├── hooks/                  # Custom React hooks
├── lib/                    # Utilities, Plaid client, auth config, encryption
├── test/                   # Test setup and helpers
├── types/                  # TypeScript type definitions
└── generated/              # Prisma generated client
prisma/
├── schema.prisma           # Database schema
└── migrations/             # Database migrations
```

## Roadmap

- [ ] Demo mode for public showcase
- [ ] Plaid production environment
- [ ] Custom domain email
- [ ] Mobile-responsive improvements
- [ ] Investment tracking

## License

Private — All rights reserved.
