# Vault — Personal Finance Dashboard

## Stack

- Next.js 14+ (App Router) with TypeScript
- Tailwind CSS + shadcn/ui
- PostgreSQL via Prisma ORM
- NextAuth.js (Google + email/password)
- Plaid Node SDK for financial account linking
- Recharts for data visualization

## Commands

- `npm run dev` — Start dev server (localhost:3000)
- `npm run build` — Production build
- `npm run lint` — Run ESLint
- `npx prisma migrate dev` — Run database migrations
- `npx prisma generate` — Regenerate Prisma client
- `npx prisma studio` — Open Prisma database GUI

## Project Structure

```txt
src/
  app/              # App Router pages & layouts
  components/       # Reusable UI components
    ui/             # shadcn/ui primitives
  lib/              # Utilities, clients, config
    prisma.ts       # Prisma client singleton
    plaid.ts        # Plaid client config
    auth.ts         # NextAuth config
    encryption.ts   # AES-256-GCM helpers
  types/            # Shared TypeScript types
prisma/
  schema.prisma     # Database schema
```

## Conventions

- Use `src/` directory for all application code
- Server components by default; add `"use client"` only when needed
- Prisma client must be a singleton (see `src/lib/prisma.ts`)
- All API routes require authentication checks
- Plaid access tokens must be encrypted at rest (AES-256-GCM)
- No mock/fake data — use empty states with prompts to link accounts
- Keep code readable — avoid over-abstraction
