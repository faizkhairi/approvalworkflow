# ApprovalKit — CLAUDE.md

## Project Overview
Multi-step approval workflow builder for teams. Next.js 16 + Prisma 7 + Neon PostgreSQL + NextAuth v5.
Portfolio project targeting Malaysian enterprise/GLC market.

## Stack
| Layer | Package |
|-------|---------|
| Framework | Next.js 16.1.6 (App Router) |
| Auth | NextAuth v5 (next-auth@^5.0.0-beta.29) + @auth/prisma-adapter |
| ORM | Prisma 7.4.1 + @prisma/adapter-neon + @neondatabase/serverless |
| DB | Neon PostgreSQL (serverless) |
| UI | Shadcn/ui + Tailwind CSS v4 |
| Queue | @upstash/qstash (for email notification jobs) |
| Email | Resend + @react-email/components |
| Validation | Zod v4 + react-hook-form + @hookform/resolvers |
| Testing | Vitest + @testing-library/react |

## Key Architectural Decisions

### Workflow Engine
- `lib/workflow-engine.ts` — `advanceRequest()` runs inside `db.$transaction`
- Rejection kills the entire chain immediately
- ANY mode: one approval advances; ALL mode: all siblings must approve
- Approvers are snapshotted at request creation (not re-resolved on activation)
- `AuditLog` is append-only — never UPDATE or DELETE rows in that table
- QStash jobs enqueued AFTER transaction commits (not inside it)

### Prisma 7 + Neon
- `lib/db.ts` uses `PrismaNeon({ connectionString })` — NOT `neon(url)` function
  The `{ connectionString }` form creates a WebSocket Pool, which supports transactions
- Schema output: `app/generated/prisma` (not @prisma/client)
- Import: `import { ... } from "@/app/generated/prisma"`
- `prisma.config.ts` (root) handles CLI migration connection via `defineConfig`

### Auth
- JWT strategy (no DB hit on `auth()` call)
- `session.user.id` populated via `callbacks.jwt + callbacks.session`
- Credentials provider: email + bcryptjs hashed password
- Middleware at `middleware.ts` protects all routes except /login, /register, /api/auth

## File Structure
```
app/
  (auth)/       # login, register (centered auth layout)
  (app)/        # protected pages (sidebar layout)
    dashboard/
    orgs/
      new/
      [orgId]/
        inbox/       # approver's pending items
        requests/    # org request list
        workflows/   # workflow templates
components/
  ui/            # Shadcn components
  app-sidebar.tsx
lib/
  db.ts          # Prisma client (WebSocket adapter)
  auth.ts        # NextAuth config
  validations.ts # Zod schemas
  workflow-engine.ts  # advanceRequest + initializeRequestSteps
prisma/
  schema.prisma
prisma.config.ts   # Prisma 7 CLI config (root level)
```

## API Routes
```
POST   /api/register
GET    /api/orgs
POST   /api/orgs
GET    /api/orgs/:orgId/workflows
POST   /api/orgs/:orgId/workflows
GET    /api/orgs/:orgId/requests
POST   /api/orgs/:orgId/requests       # calls initializeRequestSteps
GET    /api/orgs/:orgId/requests/:id
PATCH  /api/orgs/:orgId/requests/:id   # cancel only
POST   /api/orgs/:orgId/requests/:id/steps/:stepId/approve   # calls advanceRequest
POST   /api/orgs/:orgId/requests/:id/steps/:stepId/reject    # calls advanceRequest
GET    /api/notifications
PATCH  /api/notifications              # mark all read
GET    /api/notifications/unread       # count only (polled every 30s)
```

## Development Setup
```bash
npm install
cp .env.example .env.local
# Fill in DATABASE_URL, AUTH_SECRET, etc.
npx prisma generate   # generates app/generated/prisma
npx prisma db push    # push schema to Neon (dev only; use migrate in prod)
npm run dev
```

## Prisma Commands
```bash
npx prisma generate          # regenerate types after schema changes
npx prisma db push           # sync schema to DB (no migration file)
npx prisma migrate dev       # create + apply migration file (use in prod)
npx prisma studio            # visual DB browser
```

## Pre-Push Checklist
```bash
npm run build    # must be zero type errors, zero build errors
npm run lint     # must be clean
# npx prisma generate runs automatically via postinstall
```

## Common Gotchas
- `PrismaClient` constructor requires `adapter` — never call `new PrismaClient()` without it
- `AuditLog`: never update or delete — append only. Violation breaks compliance audit trail.
- For ALL mode, each approver gets their own `RequestStep` row at the same `stepOrder`
- `session.user.id` requires the `callbacks.jwt + callbacks.session` pair in `lib/auth.ts`
- Shadcn uses `sonner` (not the deprecated `toast` component)
