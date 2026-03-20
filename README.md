# Vault

A personal finance dashboard for tracking accounts, transactions, and spending — powered by Plaid.

## Tech Stack

- **Framework:** Next.js 14+ (App Router, TypeScript)
- **Styling:** Tailwind CSS + shadcn/ui
- **Database:** PostgreSQL + Prisma ORM
- **Auth:** NextAuth.js (Google + email/password)
- **Banking:** Plaid API
- **Charts:** Recharts

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 17+

### Setup

```bash
# Install dependencies
npm install

# Copy env file and fill in your values
cp .env.example .env

# Run database migrations
npx prisma migrate dev

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## License

Private — All rights reserved.
