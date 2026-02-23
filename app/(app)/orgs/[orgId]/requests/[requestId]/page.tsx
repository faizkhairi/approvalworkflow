import { redirect, notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { formatDistanceToNow, format } from "date-fns"
import { RequestActions } from "./request-actions"
import type { Metadata } from "next"

export const metadata: Metadata = { title: "Request" }

type Params = { params: Promise<{ orgId: string; requestId: string }> }

const statusColors: Record<string, { bg: string; text: string }> = {
  PENDING:     { bg: "bg-zinc-100 dark:bg-zinc-800",     text: "text-zinc-600 dark:text-zinc-300" },
  IN_PROGRESS: { bg: "bg-amber-50 dark:bg-amber-950",    text: "text-amber-700 dark:text-amber-400" },
  APPROVED:    { bg: "bg-emerald-50 dark:bg-emerald-950", text: "text-emerald-700 dark:text-emerald-400" },
  REJECTED:    { bg: "bg-red-50 dark:bg-red-950",         text: "text-red-700 dark:text-red-400" },
  CANCELLED:   { bg: "bg-zinc-100 dark:bg-zinc-800",     text: "text-zinc-400" },
}

const stepStatusDot: Record<string, string> = {
  PENDING:   "bg-zinc-300",
  ACTIVE:    "bg-amber-400 animate-pulse",
  APPROVED:  "bg-emerald-500",
  REJECTED:  "bg-red-500",
  SKIPPED:   "bg-zinc-200",
  ESCALATED: "bg-orange-400",
}

export default async function RequestDetailPage({ params }: Params) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { orgId, requestId } = await params

  const member = await db.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId: session.user.id } },
  })
  if (!member) redirect("/dashboard")

  const request = await db.request.findFirst({
    where: { id: requestId, orgId },
    include: {
      workflow: { include: { steps: { orderBy: { order: "asc" } } } },
      submitter: { select: { id: true, name: true, email: true, image: true } },
      steps: {
        include: { workflowStep: true },
        orderBy: [{ stepOrder: "asc" }],
      },
      auditLogs: {
        include: { actor: { select: { id: true, name: true, image: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  })

  if (!request) notFound()

  // Find the active step for the current user (if any)
  const myActiveStep = request.steps.find(
    (s) => s.assignedTo === session.user.id && s.status === "ACTIVE",
  )

  const statusStyle = statusColors[request.status] ?? statusColors.PENDING

  // Group steps by stepOrder for display
  const stepsByOrder = request.steps.reduce(
    (acc, step) => {
      if (!acc[step.stepOrder]) acc[step.stepOrder] = []
      acc[step.stepOrder].push(step)
      return acc
    },
    {} as Record<number, typeof request.steps>,
  )

  const formData = request.formData as Record<string, unknown>

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{request.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-zinc-500">
            <span>
              Submitted by <span className="font-medium">{request.submitter.name}</span>
            </span>
            <span>·</span>
            <span>{formatDistanceToNow(request.createdAt, { addSuffix: true })}</span>
            <span>·</span>
            <span>{request.workflow.name}</span>
          </div>
        </div>
        <span
          className={`inline-flex shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${statusStyle.bg} ${statusStyle.text}`}
        >
          {request.status.replace("_", " ")}
        </span>
      </div>

      {/* Approve / Reject actions (server-rendered wrapper around client buttons) */}
      {myActiveStep && request.status === "IN_PROGRESS" && (
        <RequestActions
          orgId={orgId}
          requestId={requestId}
          stepId={myActiveStep.id}
          stepName={myActiveStep.workflowStep.name}
        />
      )}

      {/* Form data submitted */}
      {Object.keys(formData).length > 0 && (
        <section>
          <h2 className="mb-3 text-base font-semibold text-zinc-900 dark:text-zinc-50">
            Submitted information
          </h2>
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800">
            {Object.entries(formData).map(([key, value]) => (
              <div key={key} className="grid grid-cols-3 gap-4 px-4 py-3">
                <dt className="text-sm font-medium text-zinc-500 capitalize">
                  {key.replace(/_/g, " ")}
                </dt>
                <dd className="col-span-2 text-sm text-zinc-900 dark:text-zinc-50">
                  {String(value ?? "—")}
                </dd>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Step timeline */}
      <section>
        <h2 className="mb-3 text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Approval steps
        </h2>
        <div className="space-y-2">
          {Object.entries(stepsByOrder).map(([orderStr, steps]) => {
            const order = parseInt(orderStr)
            const workflowStep = request.workflow.steps.find((s) => s.order === order)
            const isCurrentStep = order === request.currentStep
            return (
              <div
                key={order}
                className={`rounded-lg border p-4 ${isCurrentStep && request.status === "IN_PROGRESS" ? "border-amber-300 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20" : "border-zinc-200 dark:border-zinc-800"}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    Step {order}: {workflowStep?.name}
                  </span>
                  <span className="text-xs text-zinc-400">
                    {workflowStep?.approvalMode === "ALL" ? "All must approve" : "Any can approve"}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {steps.map((step) => (
                    <div key={step.id} className="flex items-start gap-2.5">
                      <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${stepStatusDot[step.status]}`} />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-zinc-600 dark:text-zinc-300">
                          {step.assignedTo === session.user.id ? "You" : "Assignee"}
                        </span>
                        {step.decidedAt && (
                          <span className="ml-2 text-xs text-zinc-400">
                            {step.decision === "APPROVED" ? "Approved" : "Rejected"}{" "}
                            {formatDistanceToNow(step.decidedAt, { addSuffix: true })}
                          </span>
                        )}
                        {step.comment && (
                          <p className="mt-0.5 text-xs text-zinc-500 italic">&ldquo;{step.comment}&rdquo;</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Audit log */}
      <section>
        <h2 className="mb-3 text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Activity log
        </h2>
        <ol className="relative border-l border-zinc-200 dark:border-zinc-800 ml-2 space-y-4">
          {request.auditLogs.map((log) => (
            <li key={log.id} className="ml-4">
              <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border border-white bg-zinc-300 dark:border-zinc-950 dark:bg-zinc-600" />
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50 font-mono">
                  {log.action}
                </span>
                <span className="text-xs text-zinc-400">
                  {format(log.createdAt, "d MMM yyyy HH:mm")}
                </span>
              </div>
              {log.actor && (
                <p className="text-xs text-zinc-500 mt-0.5">by {log.actor.name ?? "Unknown"}</p>
              )}
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
