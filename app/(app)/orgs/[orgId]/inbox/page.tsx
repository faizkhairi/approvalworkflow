import { redirect } from "next/navigation"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { formatDistanceToNow } from "date-fns"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { Metadata } from "next"

export const metadata: Metadata = { title: "Inbox" }

type Params = { params: Promise<{ orgId: string }> }

export default async function InboxPage({ params }: Params) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { orgId } = await params

  const member = await db.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId: session.user.id } },
  })
  if (!member) redirect("/dashboard")

  // Steps assigned to this user that are waiting for their decision
  const pendingSteps = await db.requestStep.findMany({
    where: {
      assignedTo: session.user.id,
      status: "ACTIVE",
      request: { orgId, status: "IN_PROGRESS" },
    },
    include: {
      workflowStep: true,
      request: {
        include: {
          workflow: { select: { id: true, name: true } },
          submitter: { select: { id: true, name: true, image: true } },
        },
      },
    },
    orderBy: [
      { dueAt: "asc" },    // most urgent first
      { request: { createdAt: "asc" } },
    ],
  })

  const isOverdue = (dueAt: Date | null) => dueAt && new Date(dueAt) < new Date()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Inbox</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {pendingSteps.length === 0
              ? "No pending approvals"
              : `${pendingSteps.length} request${pendingSteps.length === 1 ? "" : "s"} awaiting your decision`}
          </p>
        </div>
      </div>

      {pendingSteps.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-200 py-16 text-center dark:border-zinc-800">
          <p className="text-sm font-medium text-zinc-500">You&apos;re all caught up</p>
          <p className="text-xs text-zinc-400 mt-1">No requests are waiting for your approval.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pendingSteps.map((step) => (
            <Card
              key={step.id}
              className={`transition-shadow hover:shadow-sm ${isOverdue(step.dueAt) ? "border-red-200 dark:border-red-900" : ""}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/orgs/${orgId}/requests/${step.requestId}`}
                      className="font-semibold text-zinc-900 hover:underline dark:text-zinc-50 block truncate"
                    >
                      {step.request.title}
                    </Link>

                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                      <span>
                        Step {step.stepOrder}: <span className="font-medium">{step.workflowStep.name}</span>
                      </span>
                      <span>·</span>
                      <span>Workflow: {step.request.workflow.name}</span>
                      <span>·</span>
                      <span>
                        By {step.request.submitter.name ?? "Unknown"}{" "}
                        {formatDistanceToNow(step.request.createdAt, { addSuffix: true })}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <Badge
                      variant="outline"
                      className={
                        isOverdue(step.dueAt)
                          ? "border-red-200 text-red-600 dark:border-red-800"
                          : step.dueAt
                          ? "border-amber-200 text-amber-600 dark:border-amber-800"
                          : ""
                      }
                    >
                      {isOverdue(step.dueAt)
                        ? `Overdue ${formatDistanceToNow(step.dueAt!, { addSuffix: true })}`
                        : step.dueAt
                        ? `Due ${formatDistanceToNow(step.dueAt, { addSuffix: true })}`
                        : "No deadline"}
                    </Badge>
                    <Link
                      href={`/orgs/${orgId}/requests/${step.requestId}`}
                      className="text-xs font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                    >
                      Review →
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
