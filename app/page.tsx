import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const features = [
  {
    title: "Multi-Step Workflows",
    description:
      "Define sequential approval chains with configurable ANY or ALL approval modes per step.",
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
  },
  {
    title: "Organization Management",
    description:
      "Create organizations, invite members, and assign Owner, Admin, or Member roles.",
    icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
  },
  {
    title: "Smart Routing",
    description:
      "Route approvals to specific users or role-based approver groups with fallback chains.",
    icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",
  },
  {
    title: "Real-Time Notifications",
    description:
      "In-app notification system with unread counts. Never miss a pending approval.",
    icon: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9",
  },
  {
    title: "Audit Trail",
    description:
      "Immutable, append-only audit logs for every action. Full compliance and accountability.",
    icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  },
  {
    title: "Timeout Handling",
    description:
      "Auto-escalate, auto-approve, or auto-reject when approvals exceed their deadline.",
    icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  },
]

const workflowSteps = [
  { label: "Submitted", color: "bg-blue-500" },
  { label: "Line Manager", color: "bg-amber-500" },
  { label: "Finance", color: "bg-purple-500" },
  { label: "Director", color: "bg-emerald-500" },
  { label: "Approved", color: "bg-green-600" },
]

const useCases = [
  {
    title: "Leave Requests",
    description: "Employee submits, manager approves, HR records.",
  },
  {
    title: "Procurement",
    description: "Requester submits, budget holder approves, finance releases.",
  },
  {
    title: "Travel Claims",
    description: "Staff claims, supervisor verifies, accounts processes.",
  },
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="text-xl font-bold tracking-tight">
            ApprovalWorkflow
          </span>
          <div className="flex gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Sign In
              </Button>
            </Link>
            <Link href="/register">
              <Button size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-5xl px-6 py-20 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Multi-step approval workflows for teams
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Configurable, auditable, and fast. Define approval chains, route to
            the right people, and track every decision with a full audit trail.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link href="/register">
              <Button size="lg">Start Building Workflows</Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="lg">
                Sign In
              </Button>
            </Link>
          </div>
        </section>

        {/* Workflow visualization */}
        <section className="mx-auto max-w-5xl px-6 pb-16">
          <div className="rounded-xl border bg-card p-6">
            <h2 className="mb-6 text-center text-sm font-medium text-muted-foreground">
              Example: Purchase Order Approval
            </h2>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {workflowSteps.map((step, i) => (
                <div key={step.label} className="flex items-center gap-2">
                  <div className="flex items-center gap-2 rounded-lg border px-4 py-2">
                    <span
                      className={`inline-block h-2.5 w-2.5 rounded-full ${step.color}`}
                    />
                    <span className="text-sm font-medium">{step.label}</span>
                  </div>
                  {i < workflowSteps.length - 1 && (
                    <svg
                      className="h-4 w-4 text-muted-foreground"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features grid */}
        <section className="mx-auto max-w-5xl px-6 pb-16">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <Card key={feature.title}>
                <CardContent className="pt-6">
                  <svg
                    className="mb-3 h-8 w-8 text-primary"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d={feature.icon}
                    />
                  </svg>
                  <h3 className="font-semibold">{feature.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Use cases */}
        <section className="mx-auto max-w-5xl px-6 pb-20">
          <h2 className="mb-6 text-center text-xl font-semibold">Use Cases</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {useCases.map((uc) => (
              <div
                key={uc.title}
                className="rounded-lg border p-5 text-center"
              >
                <Badge variant="secondary" className="mb-2">
                  {uc.title}
                </Badge>
                <p className="text-sm text-muted-foreground">
                  {uc.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Tech footer */}
        <section className="border-t py-8 text-center text-sm text-muted-foreground">
          Built with Next.js, Prisma, and Neon PostgreSQL
        </section>
      </main>
    </div>
  )
}
