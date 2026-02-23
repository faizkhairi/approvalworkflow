import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { createWorkflowSchema } from "@/lib/validations"

type Params = { params: Promise<{ orgId: string }> }

async function assertOrgMember(orgId: string, userId: string) {
  const member = await db.orgMember.findUnique({ where: { orgId_userId: { orgId, userId } } })
  return member
}

// GET /api/orgs/:orgId/workflows
export async function GET(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { orgId } = await params
  if (!await assertOrgMember(orgId, session.user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const workflows = await db.workflow.findMany({
    where: { orgId },
    include: {
      _count: { select: { steps: true, requests: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(workflows)
}

// POST /api/orgs/:orgId/workflows
export async function POST(req: Request, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { orgId } = await params
  const member = await assertOrgMember(orgId, session.user.id)
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (!["OWNER", "ADMIN"].includes(member.role)) {
    return NextResponse.json({ error: "Only admins can create workflows" }, { status: 403 })
  }

  const body = await req.json()
  const parsed = createWorkflowSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Validation error" }, { status: 400 })
  }

  const workflow = await db.$transaction(async (tx) => {
    const newWorkflow = await tx.workflow.create({
      data: {
        orgId,
        name: parsed.data.name,
        description: parsed.data.description,
        category: parsed.data.category,
        formSchema: parsed.data.formSchema,
      },
    })

    for (const step of parsed.data.steps) {
      await tx.workflowStep.create({
        data: {
          workflowId: newWorkflow.id,
          order: step.order,
          name: step.name,
          approvalMode: step.approvalMode,
          approverType: step.approverType,
          approverIds: step.approverIds,
          timeoutHours: step.timeoutHours,
          timeoutAction: step.timeoutAction,
          escalateTo: step.escalateTo,
        },
      })
    }

    return newWorkflow
  })

  return NextResponse.json(workflow, { status: 201 })
}
