import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

type Params = { params: Promise<{ orgId: string; requestId: string }> }

// GET /api/orgs/:orgId/requests/:requestId — full request detail with steps and audit log
export async function GET(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { orgId, requestId } = await params

  const member = await db.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId: session.user.id } },
  })
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const request = await db.request.findFirst({
    where: { id: requestId, orgId },
    include: {
      workflow: {
        include: { steps: { orderBy: { order: "asc" } } },
      },
      submitter: { select: { id: true, name: true, image: true, email: true } },
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

  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json(request)
}

// PATCH /api/orgs/:orgId/requests/:requestId — cancel a request (submitter only)
export async function PATCH(req: Request, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { orgId, requestId } = await params

  const request = await db.request.findFirst({
    where: { id: requestId, orgId },
  })
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (request.submitterId !== session.user.id) {
    return NextResponse.json({ error: "Only the submitter can cancel this request" }, { status: 403 })
  }
  if (!["PENDING", "IN_PROGRESS"].includes(request.status)) {
    return NextResponse.json({ error: "Only active requests can be cancelled" }, { status: 400 })
  }

  const updated = await db.$transaction(async (tx) => {
    const cancelled = await tx.request.update({
      where: { id: requestId },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    })
    await tx.auditLog.create({
      data: { requestId, actorId: session.user!.id, action: "CANCELLED" },
    })
    return cancelled
  })

  return NextResponse.json(updated)
}
