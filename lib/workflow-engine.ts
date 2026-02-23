/**
 * Workflow Engine — advanceRequest
 *
 * This is the heart of the approval system. It is called after every approve
 * or reject action and handles all state transitions atomically inside a
 * Prisma interactive transaction.
 *
 * Design decisions:
 * - All DB mutations happen inside db.$transaction → either everything commits
 *   or nothing does. No partial state.
 * - QStash notification jobs are enqueued AFTER the transaction commits.
 *   If an email fails, the approval decision is NOT rolled back.
 * - AuditLog rows are append-only — this function never updates/deletes them.
 * - Approver IDs are snapshotted at request creation time — we never re-resolve
 *   them here. Role changes after submission do not affect in-flight requests.
 */

import type { Prisma, StepDecision } from "@/app/generated/prisma"
import { db } from "./db"

// ─── Types ────────────────────────────────────────────────────────────────────

type PrismaTransactionClient = Prisma.TransactionClient

export type AdvanceResult =
  | { newStatus: "IN_PROGRESS"; waitingForMore: true }
  | { newStatus: "IN_PROGRESS"; nextStepOrder: number; notifyUserIds: string[] }
  | { newStatus: "APPROVED"; notifyUserIds: string[] }
  | { newStatus: "REJECTED"; notifyUserIds: string[] }

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function appendAuditLog(
  tx: PrismaTransactionClient,
  requestId: string,
  actorId: string | null,
  action: string,
  detail?: Record<string, unknown>,
  ip?: string,
  userAgent?: string,
) {
  await tx.auditLog.create({
    // JSON.parse/stringify ensures the detail object satisfies Prisma's InputJsonValue constraint
    data: { requestId, actorId, action, detail: detail ? JSON.parse(JSON.stringify(detail)) : undefined, ip, userAgent },
  })
}

function computeDueAt(timeoutHours: number | null): Date | null {
  if (!timeoutHours) return null
  return new Date(Date.now() + timeoutHours * 60 * 60 * 1000)
}

// ─── Core Engine ─────────────────────────────────────────────────────────────

/**
 * advanceRequest — call this inside a db.$transaction after recording a decision.
 *
 * Guarantees:
 *   - ANY mode: one approval is sufficient to advance the step.
 *   - ALL mode: every RequestStep at the current stepOrder must be APPROVED.
 *   - One REJECTED at any point kills the entire chain immediately.
 *   - The final step approval transitions status → APPROVED.
 */
export async function advanceRequest(
  requestId: string,
  decidedStepId: string,
  decision: StepDecision,
  actorId: string,
  tx: PrismaTransactionClient,
  meta?: { ip?: string; userAgent?: string },
): Promise<AdvanceResult> {
  // Load full request context (steps + workflow definition)
  const request = await tx.request.findUniqueOrThrow({
    where: { id: requestId },
    include: {
      steps: { include: { workflowStep: true } },
      workflow: { include: { steps: { orderBy: { order: "asc" } } } },
    },
  })

  const currentStepOrder = request.currentStep
  const decidedStep = request.steps.find((s) => s.id === decidedStepId)
  if (!decidedStep) throw new Error(`Step ${decidedStepId} not found on request ${requestId}`)

  // ── 1. Handle REJECTION — kills the chain immediately ─────────────────────
  if (decision === "REJECTED") {
    await tx.request.update({
      where: { id: requestId },
      data: { status: "REJECTED", completedAt: new Date() },
    })

    await appendAuditLog(
      tx,
      requestId,
      actorId,
      `REJECTED_STEP_${currentStepOrder}`,
      { stepName: decidedStep.workflowStep.name, stepId: decidedStepId },
      meta?.ip,
      meta?.userAgent,
    )

    const notifyUserIds = [request.submitterId]
    return { newStatus: "REJECTED", notifyUserIds }
  }

  // ── 2. Record approval audit log ──────────────────────────────────────────
  await appendAuditLog(
    tx,
    requestId,
    actorId,
    `APPROVED_STEP_${currentStepOrder}`,
    { stepName: decidedStep.workflowStep.name, stepId: decidedStepId },
    meta?.ip,
    meta?.userAgent,
  )

  // ── 3. Check if step is complete (ANY vs ALL approval mode) ───────────────
  const currentWorkflowStep = decidedStep.workflowStep
  const siblingsAtCurrentOrder = request.steps.filter(
    (s) => s.stepOrder === currentStepOrder,
  )

  if (currentWorkflowStep.approvalMode === "ALL") {
    // ALL mode: every sibling must be APPROVED (count the just-decided step as approved)
    const allApproved = siblingsAtCurrentOrder.every(
      (s) => s.status === "APPROVED" || s.id === decidedStepId,
    )
    if (!allApproved) {
      // Still waiting for other approvers — no state transition yet
      return { newStatus: "IN_PROGRESS", waitingForMore: true }
    }
  }
  // ANY mode: reaching here means one approval is sufficient — advance immediately

  // ── 4. Find the next workflow step definition ──────────────────────────────
  const nextWorkflowStep = request.workflow.steps.find(
    (s) => s.order === currentStepOrder + 1,
  )

  if (!nextWorkflowStep) {
    // Final step approved → mark the entire request as APPROVED
    await tx.request.update({
      where: { id: requestId },
      data: { status: "APPROVED", completedAt: new Date() },
    })

    await appendAuditLog(tx, requestId, null, "REQUEST_APPROVED", undefined, meta?.ip, meta?.userAgent)

    const notifyUserIds = [request.submitterId]
    return { newStatus: "APPROVED", notifyUserIds }
  }

  // ── 5. Activate next step ─────────────────────────────────────────────────
  await tx.request.update({
    where: { id: requestId },
    data: {
      status: "IN_PROGRESS",
      currentStep: currentStepOrder + 1,
    },
  })

  const dueAt = computeDueAt(nextWorkflowStep.timeoutHours)

  await tx.requestStep.updateMany({
    where: { requestId, stepOrder: currentStepOrder + 1 },
    data: { status: "ACTIVE", dueAt: dueAt ?? undefined },
  })

  await appendAuditLog(
    tx,
    requestId,
    null,
    `STEP_${currentStepOrder + 1}_ACTIVATED`,
    { stepName: nextWorkflowStep.name },
    meta?.ip,
    meta?.userAgent,
  )

  // Collect user IDs to notify (the next step's assignees)
  const nextRequestSteps = request.steps.filter(
    (s) => s.stepOrder === currentStepOrder + 1,
  )
  const notifyUserIds = nextRequestSteps
    .map((s) => s.assignedTo)
    .filter(Boolean) as string[]

  return { newStatus: "IN_PROGRESS", nextStepOrder: currentStepOrder + 1, notifyUserIds }
}

// ─── Request Initialization ───────────────────────────────────────────────────

/**
 * initializeRequestSteps — called inside db.$transaction when a new request is submitted.
 *
 * Resolves approvers from WorkflowStep definitions and creates RequestStep rows
 * with approvers snapshotted at submission time. The first step is immediately
 * set to ACTIVE; all subsequent steps are PENDING.
 *
 * Role-based approvers (approverType = ROLE) are resolved here against OrgMember
 * records so that future role changes don't affect this request.
 */
export async function initializeRequestSteps(
  requestId: string,
  workflowId: string,
  orgId: string,
  tx: PrismaTransactionClient,
): Promise<void> {
  const workflow = await tx.workflow.findUniqueOrThrow({
    where: { id: workflowId },
    include: { steps: { orderBy: { order: "asc" } } },
  })

  for (const workflowStep of workflow.steps) {
    let resolvedApproverIds: string[] = workflowStep.approverIds

    // Resolve role names to user IDs at submission time
    if (workflowStep.approverType === "ROLE") {
      const members = await tx.orgMember.findMany({
        where: {
          orgId,
          role: { in: workflowStep.approverIds as ("OWNER" | "ADMIN" | "MEMBER")[] },
        },
        select: { userId: true },
      })
      resolvedApproverIds = members.map((m) => m.userId)
    }

    // Create one RequestStep per approver (enables ALL-mode parallel tracking)
    for (const approverId of resolvedApproverIds) {
      const dueAt =
        workflowStep.order === 1 ? computeDueAt(workflowStep.timeoutHours) : null

      await tx.requestStep.create({
        data: {
          requestId,
          workflowStepId: workflowStep.id,
          stepOrder: workflowStep.order,
          status: workflowStep.order === 1 ? "ACTIVE" : "PENDING",
          assignedTo: approverId,
          dueAt,
        },
      })
    }
  }
}
