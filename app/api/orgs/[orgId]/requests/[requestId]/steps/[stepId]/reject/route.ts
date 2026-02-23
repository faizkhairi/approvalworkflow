import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { rejectStepSchema } from "@/lib/validations"
import { advanceRequest } from "@/lib/workflow-engine"

type Params = { params: Promise<{ orgId: string; requestId: string; stepId: string }> }

// POST /api/orgs/:orgId/requests/:requestId/steps/:stepId/reject
// Rejection immediately kills the entire approval chain.
// A comment is required — this is enforced both in the Zod schema and the UI.
export async function POST(req: Request, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { orgId, requestId, stepId } = await params

  const body = await req.json().catch(() => ({}))
  const parsed = rejectStepSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Validation error" }, { status: 400 })
  }

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
    await tx.requestStep.update({
      where: { id: stepId },
      data: {
        status: "REJECTED",
        decision: "REJECTED",
        decidedById: session.user!.id,
        decidedAt: new Date(),
        comment: parsed.data.comment,
      },
    })

    return advanceRequest(requestId, stepId, "REJECTED", session.user!.id, tx, { ip, userAgent })
  })

  // Notify the submitter that their request was rejected
  if ("notifyUserIds" in result) {
    void notifySubmitter(result.notifyUserIds, requestId, orgId, parsed.data.comment)
  }

  return NextResponse.json({ success: true, result })
}

async function notifySubmitter(
  userIds: string[],
  requestId: string,
  orgId: string,
  comment: string,
) {
  const request = await db.request.findUnique({
    where: { id: requestId },
    select: { title: true },
  })
  if (!request) return

  await db.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      title: `Request rejected: "${request.title}"`,
      body: comment,
      link: `/orgs/${orgId}/requests/${requestId}`,
    })),
  })
}
