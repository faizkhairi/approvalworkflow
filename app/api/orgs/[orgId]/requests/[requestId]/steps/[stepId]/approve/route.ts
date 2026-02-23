import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { approveStepSchema } from "@/lib/validations"
import { advanceRequest } from "@/lib/workflow-engine"

type Params = { params: Promise<{ orgId: string; requestId: string; stepId: string }> }

// POST /api/orgs/:orgId/requests/:requestId/steps/:stepId/approve
export async function POST(req: Request, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { orgId, requestId, stepId } = await params

  const body = await req.json().catch(() => ({}))
  const parsed = approveStepSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Validation error" }, { status: 400 })
  }

  // Verify the step is assigned to the current user and is ACTIVE
  const step = await db.requestStep.findFirst({
    where: { id: stepId, requestId, assignedTo: session.user.id, status: "ACTIVE" },
    include: { request: true },
  })
  if (!step) {
    return NextResponse.json({ error: "Step not found or not assigned to you" }, { status: 404 })
  }
  if (step.request.orgId !== orgId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const userAgent = req.headers.get("user-agent") ?? undefined
  const ip = req.headers.get("x-forwarded-for") ?? undefined

  const result = await db.$transaction(async (tx) => {
    // Record the decision on this step
    await tx.requestStep.update({
      where: { id: stepId },
      data: {
        status: "APPROVED",
        decision: "APPROVED",
        decidedById: session.user!.id,
        decidedAt: new Date(),
        comment: parsed.data.comment,
      },
    })

    // Advance the request state machine
    return advanceRequest(requestId, stepId, "APPROVED", session.user!.id, tx, { ip, userAgent })
  })

  // Enqueue notifications after transaction commits (fire-and-forget)
  if ("notifyUserIds" in result && result.notifyUserIds.length > 0) {
    void enqueueNotifications(result.notifyUserIds, requestId, orgId, result.newStatus)
  }

  return NextResponse.json({ success: true, result })
}

// Fire-and-forget: create in-app notifications for status changes
// In production, replace with a QStash job for email delivery
async function enqueueNotifications(
  userIds: string[],
  requestId: string,
  orgId: string,
  newStatus: string,
) {
  const request = await db.request.findUnique({
    where: { id: requestId },
    select: { title: true },
  })
  if (!request) return

  const isComplete = newStatus === "APPROVED" || newStatus === "REJECTED"
  const title = isComplete
    ? `Request ${newStatus.toLowerCase()}: "${request.title}"`
    : `Action required: "${request.title}"`
  const body = isComplete
    ? `Your request has been ${newStatus.toLowerCase()}.`
    : `A step in "${request.title}" is awaiting your approval.`

  await db.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      title,
      body,
      link: `/orgs/${orgId}/requests/${requestId}`,
    })),
  })
}
