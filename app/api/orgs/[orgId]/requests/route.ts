import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { createRequestSchema } from "@/lib/validations"
import { initializeRequestSteps } from "@/lib/workflow-engine"

type Params = { params: Promise<{ orgId: string }> }

// GET /api/orgs/:orgId/requests — list requests in this org
export async function GET(req: Request, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { orgId } = await params

  const member = await db.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId: session.user.id } },
  })
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status") as "PENDING" | "IN_PROGRESS" | "APPROVED" | "REJECTED" | "CANCELLED" | null
  const workflowId = searchParams.get("workflowId")

  const requests = await db.request.findMany({
    where: {
      orgId,
      ...(status && { status }),
      ...(workflowId && { workflowId }),
    },
    include: {
      workflow: { select: { id: true, name: true } },
      submitter: { select: { id: true, name: true, image: true } },
      _count: { select: { steps: true, auditLogs: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  return NextResponse.json(requests)
}

// POST /api/orgs/:orgId/requests — submit a new approval request
export async function POST(req: Request, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { orgId } = await params

  const member = await db.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId: session.user.id } },
  })
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const parsed = createRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Validation error" }, { status: 400 })
  }

  // Verify the workflow belongs to this org and is active
  const workflow = await db.workflow.findFirst({
    where: { id: parsed.data.workflowId, orgId, isActive: true },
    include: { steps: true },
  })
  if (!workflow) {
    return NextResponse.json({ error: "Workflow not found or inactive" }, { status: 404 })
  }
  if (workflow.steps.length === 0) {
    return NextResponse.json({ error: "Workflow has no steps configured" }, { status: 400 })
  }

  const request = await db.$transaction(async (tx) => {
    const newRequest = await tx.request.create({
      data: {
        orgId,
        workflowId: parsed.data.workflowId,
        submitterId: session.user!.id,
        title: parsed.data.title,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        formData: JSON.parse(JSON.stringify(parsed.data.formData)),
        status: "IN_PROGRESS",
        currentStep: 1,
      },
    })

    // Snapshot approvers and create RequestStep rows
    await initializeRequestSteps(newRequest.id, workflow.id, orgId, tx)

    // Initial audit log entry
    await tx.auditLog.create({
      data: {
        requestId: newRequest.id,
        actorId: session.user!.id,
        action: "SUBMITTED",
        detail: { workflowName: workflow.name },
      },
    })

    // Create in-app notifications for the first-step approvers
    const firstStepAssignees = await tx.requestStep.findMany({
      where: { requestId: newRequest.id, stepOrder: 1 },
      select: { assignedTo: true },
    })

    await tx.notification.createMany({
      data: firstStepAssignees
        .filter((s) => s.assignedTo)
        .map((s) => ({
          userId: s.assignedTo!,
          title: "New request pending your approval",
          body: `"${newRequest.title}" has been submitted and is awaiting your review.`,
          link: `/orgs/${orgId}/requests/${newRequest.id}`,
        })),
    })

    return newRequest
  })

  return NextResponse.json(request, { status: 201 })
}
