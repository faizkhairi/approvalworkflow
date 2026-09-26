# ApprovalKit

Multi-step approval workflow builder for teams. Define an approval chain
once (workflow), then route submitted requests through it, step by step,
until every step approves or one rejects.

No hosted demo; run it locally (see below).

## Features

- Organizations with `OWNER` / `ADMIN` / `MEMBER` roles and membership checks
  on every org-scoped route
- Workflow templates: ordered steps, each with `ANY` (one approver suffices)
  or `ALL` (every assigned approver must approve) approval mode, approvers
  assigned by specific user or by role
- Requests: submit against a workflow, which snapshots the resolved
  approvers into `RequestStep` rows at submission time (later role changes
  do not affect in-flight requests)
- Approve / reject actions that atomically advance the request state machine
  (`lib/workflow-engine.ts`), inside a single Prisma transaction; rejection
  kills the chain immediately, a comment is required on reject
- Append-only audit log per request: `AuditLog` rows are never updated or
  deleted by the code
- In-app notifications with an unread count, polled from the UI
- Per-step `timeoutHours` / `timeoutAction` (`ESCALATE` / `AUTO_APPROVE` /
  `AUTO_REJECT`) and `dueAt` are modeled and stored, but no background job
  currently processes an overdue step; this is configuration only today
- `resend`, `@react-email/components`, and `@upstash/qstash` are installed
  for a planned email-notification pipeline; nothing in `app/` or `lib/`
  imports them yet, so notifications are in-app only at the moment

## Stack

- Next.js 16.1.6 (App Router) + React 19.2.3 + TypeScript 5
- NextAuth v5 (`next-auth@5.0.0-beta.29`) with `@auth/prisma-adapter`,
  credentials provider (JWT session strategy)
- Prisma 7.4.1 + `@prisma/adapter-neon` + `@neondatabase/serverless`
  (WebSocket pool, required for interactive transactions)
- Neon serverless PostgreSQL
- Tailwind CSS v4 + Radix UI primitives (via `shadcn`), `react-hook-form` +
  `@hookform/resolvers` for forms
- Zod v4 for request validation
- Vitest + Testing Library for tests

## Architecture

```
app/
  (auth)/              login, register
  (app)/
    dashboard/
    orgs/new/
    orgs/[orgId]/
      inbox/           steps assigned to the current user
      workflows/       workflow templates for the org
      requests/[id]/   request detail + approve/reject actions
  api/
    auth/[...nextauth]
    register
    orgs/                        GET list, POST create
    orgs/[orgId]/workflows/      GET list, POST create (OWNER/ADMIN only)
    orgs/[orgId]/requests/       GET list, POST submit
    orgs/[orgId]/requests/[id]/  GET, PATCH (cancel)
    .../steps/[stepId]/approve   POST: advances the workflow
    .../steps/[stepId]/reject    POST: kills the chain
    notifications/                GET, PATCH (mark all read)
    notifications/unread          GET count (polled)
lib/
  db.ts               Prisma client (Neon WebSocket adapter, singleton)
  auth.ts             NextAuth config
  validations.ts      Zod schemas for all API input
  workflow-engine.ts  advanceRequest() + initializeRequestSteps()
prisma/schema.prisma  data model
```

## Data model

- `Org` / `OrgMember`: multi-tenancy; every org-scoped route checks
  membership before reading or writing
- `Workflow` / `WorkflowStep`: ordered step definitions, `approvalMode`
  (`ANY`/`ALL`), `approverType` (`USER`/`ROLE`), `approverIds`
- `Request`: one submission against a workflow; tracks `status` and
  `currentStep`
- `RequestStep`: one row per approver per step, snapshotted at submission;
  `assignedTo`, `decidedById`, `decision`, `comment` (required on reject)
- `AuditLog`: append-only action history per request
- `Notification`: in-app notification per user

## Authorization

Every org-scoped route first resolves `OrgMember` for
`(orgId, session.user.id)` and returns 403 if there is no membership; some
routes (creating a workflow) additionally require `OWNER`/`ADMIN`. The
approve/reject routes look up the target `RequestStep` scoped to
`assignedTo: session.user.id` and `status: "ACTIVE"`, then separately check
that the step's request belongs to the `orgId` in the URL, so a step
assigned to someone else, already decided, or from a different org resolves
to 404 or 403 rather than leaking or mutating it. Unauthenticated requests
get 401 before any query runs.

## Environment variables

See `.env.example`. Required:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon Postgres connection string |
| `AUTH_SECRET` | NextAuth session secret (`openssl rand -base64 32`) |
| `AUTH_URL` | Base URL for NextAuth callbacks |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | reserved for planned email delivery (unused today) |
| `QSTASH_TOKEN` / `QSTASH_CURRENT_SIGNING_KEY` / `QSTASH_NEXT_SIGNING_KEY` | reserved for planned queued email jobs (unused today) |

## Local setup

```bash
npm install
cp .env.example .env.local
# fill in DATABASE_URL and AUTH_SECRET at minimum

npx prisma generate     # generates app/generated/prisma
npx prisma db push      # sync schema to your Neon database (dev only)
npm run dev              # http://localhost:3000
```

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | start the dev server |
| `npm run build` | production build |
| `npm start` | run the production build |
| `npm run lint` | ESLint |
| `npm test` | run the Vitest suite once |
| `npx tsc --noEmit` | type-check without emitting |

## Tests

`npm test` runs Vitest against the workflow state machine
(`lib/workflow-engine.ts`: ANY vs ALL approval mode, rejection killing the
chain, next-step activation), the Zod validation schemas, and the
authorization scoping on the org/request/approve/reject API routes (mocking
`auth()` and the Prisma client to assert membership and ownership checks run
before any mutation, and that a foreign org or step id returns 403/404).

## License

MIT
