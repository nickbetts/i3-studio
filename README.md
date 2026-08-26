# i3 Studio

Agency management SaaS with a client portal, built with Next.js (App Router) on Vercel.

Agency staff and clients sign in through the same page and are routed to different
experiences by role. Clients complete an onboarding wizard, then reach a dashboard
with their account managers and outstanding items. Agency staff manage clients,
tasks, file approvals, a Float-style scheduling calendar and support tickets.

## Tech stack

- **Framework:** Next.js 16 (App Router, React 19, TypeScript)
- **Database:** Neon Postgres + Drizzle ORM
- **Auth:** Auth.js (NextAuth v5) — shared login, role-based routing
- **Storage:** Vercel Blob (file uploads)
- **Email / ticketing:** Mailgun (outbound + inbound routes)
- **UI:** Tailwind CSS + shadcn/ui

## Roles

- **Agency:** `admin`, `account_manager`
- **Client:** `client` (belongs to a client account)

## Getting started

1. Copy env and fill in values:

   ```bash
   cp .env.example .env.local
   ```

   At minimum set `DATABASE_URL` (Neon) and `AUTH_SECRET` (`openssl rand -base64 32`).

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Push the schema to your database and seed demo data:

   ```bash
   pnpm db:push      # or: pnpm db:migrate to apply generated migrations
   pnpm db:seed
   ```

4. Run the dev server:

   ```bash
   pnpm dev
   ```

### Demo logins (after `pnpm db:seed`, password `password123`)

| Email                    | Role            | Sees                       |
| ------------------------ | --------------- | -------------------------- |
| `admin@i3studio.com`     | admin           | Agency app + calendar      |
| `manager@i3studio.com`   | account_manager | Agency app                 |
| `client@acme.com`        | client          | Onboarding wizard → portal |

## Scripts

- `pnpm dev` – start the dev server
- `pnpm build` – production build
- `pnpm db:generate` – generate SQL migrations from the schema
- `pnpm db:migrate` – apply migrations
- `pnpm db:push` – push schema directly (dev)
- `pnpm db:studio` – open Drizzle Studio
- `pnpm db:seed` – seed demo org, users and a client account

## Build phases

- **P0 Foundation** — scaffold, auth, role guard, base layout ✅
- **P1 Onboarding + client dashboard** ✅
- **P2** Agency client management + tasks
- **P3** File uploads + document approvals (Vercel Blob)
- **P4** Design pin-and-comment collaboration tool
- **P5** Support ticketing (in-platform + Mailgun)
- **P6** Float-style time-blocking calendar
- **P7** Reporting + audit logs
