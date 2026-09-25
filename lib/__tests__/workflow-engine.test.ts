import { describe, it, expect, vi, beforeEach } from "vitest"
import { advanceRequest } from "@/lib/workflow-engine"

function makeTx(request: unknown) {
  return {
    request: {
      findUniqueOrThrow: vi.fn().mockResolvedValue(request),
      update: vi.fn().mockResolvedValue(undefined),
    },
    requestStep: {
      update: vi.fn().mockResolvedValue(undefined),
      updateMany: vi.fn().mockResolvedValue(undefined),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue(undefined),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

const baseWorkflowStep = (order: number, approvalMode: "ANY" | "ALL" = "ANY") => ({
  id: `wfstep-${order}`,
  order,
  name: `Step ${order}`,
  timeoutHours: null,
  approvalMode,
})

describe("advanceRequest", () => {
  beforeEach(() => vi.clearAllMocks())

  it("ANY mode: one approval on the final step marks the whole request APPROVED", async () => {
    const request = {
      id: "req-1",
      currentStep: 1,
      submitterId: "submitter-1",
      steps: [
        { id: "step-1", stepOrder: 1, status: "ACTIVE", workflowStep: baseWorkflowStep(1, "ANY") },
      ],
      workflow: { steps: [baseWorkflowStep(1, "ANY")] }, // no step at order 2 -> final
    }
    const tx = makeTx(request)

    const result = await advanceRequest("req-1", "step-1", "APPROVED", "user-1", tx)

    expect(result).toEqual({ newStatus: "APPROVED", notifyUserIds: ["submitter-1"] })
    expect(tx.request.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "APPROVED" }) }),
    )
  })

  it("ANY mode: approving a non-final step activates the next step and notifies its assignees", async () => {
    const request = {
      id: "req-1",
      currentStep: 1,
      submitterId: "submitter-1",
      steps: [
        { id: "step-1", stepOrder: 1, status: "ACTIVE", workflowStep: baseWorkflowStep(1, "ANY") },
        { id: "step-2a", stepOrder: 2, status: "PENDING", assignedTo: "approver-a", workflowStep: baseWorkflowStep(2, "ANY") },
        { id: "step-2b", stepOrder: 2, status: "PENDING", assignedTo: "approver-b", workflowStep: baseWorkflowStep(2, "ANY") },
      ],
      workflow: { steps: [baseWorkflowStep(1, "ANY"), baseWorkflowStep(2, "ANY")] },
    }
    const tx = makeTx(request)

    const result = await advanceRequest("req-1", "step-1", "APPROVED", "user-1", tx)

    expect(result).toEqual(
      expect.objectContaining({
        newStatus: "IN_PROGRESS",
        nextStepOrder: 2,
        notifyUserIds: expect.arrayContaining(["approver-a", "approver-b"]),
      }),
    )
    expect(tx.requestStep.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { requestId: "req-1", stepOrder: 2 },
        data: expect.objectContaining({ status: "ACTIVE" }),
      }),
    )
  })

  it("ALL mode: does not advance while a sibling approver has not yet decided", async () => {
    const request = {
      id: "req-1",
      currentStep: 1,
      submitterId: "submitter-1",
      steps: [
        { id: "step-1a", stepOrder: 1, status: "ACTIVE", workflowStep: baseWorkflowStep(1, "ALL") },
        { id: "step-1b", stepOrder: 1, status: "ACTIVE", workflowStep: baseWorkflowStep(1, "ALL") },
      ],
      workflow: { steps: [baseWorkflowStep(1, "ALL")] },
    }
    const tx = makeTx(request)

    const result = await advanceRequest("req-1", "step-1a", "APPROVED", "user-1", tx)

    expect(result).toEqual({ newStatus: "IN_PROGRESS", waitingForMore: true })
    expect(tx.request.update).not.toHaveBeenCalled()
  })

  it("ALL mode: advances once every sibling at the current step has approved", async () => {
    const request = {
      id: "req-1",
      currentStep: 1,
      submitterId: "submitter-1",
      steps: [
        { id: "step-1a", stepOrder: 1, status: "APPROVED", workflowStep: baseWorkflowStep(1, "ALL") },
        { id: "step-1b", stepOrder: 1, status: "ACTIVE", workflowStep: baseWorkflowStep(1, "ALL") },
      ],
      workflow: { steps: [baseWorkflowStep(1, "ALL")] }, // final step
    }
    const tx = makeTx(request)

    // step-1b is the one being decided now; step-1a already APPROVED
    const result = await advanceRequest("req-1", "step-1b", "APPROVED", "user-1", tx)

    expect(result).toEqual({ newStatus: "APPROVED", notifyUserIds: ["submitter-1"] })
  })

  it("REJECTED kills the chain immediately regardless of approval mode", async () => {
    const request = {
      id: "req-1",
      currentStep: 1,
      submitterId: "submitter-1",
      steps: [
        { id: "step-1a", stepOrder: 1, status: "APPROVED", workflowStep: baseWorkflowStep(1, "ALL") },
        { id: "step-1b", stepOrder: 1, status: "ACTIVE", workflowStep: baseWorkflowStep(1, "ALL") },
      ],
      workflow: { steps: [baseWorkflowStep(1, "ALL"), baseWorkflowStep(2, "ALL")] },
    }
    const tx = makeTx(request)

    const result = await advanceRequest("req-1", "step-1b", "REJECTED", "user-1", tx)

    expect(result).toEqual({ newStatus: "REJECTED", notifyUserIds: ["submitter-1"] })
    expect(tx.request.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "REJECTED" }) }),
    )
    // Rejection must not touch the next step
    expect(tx.requestStep.updateMany).not.toHaveBeenCalled()
  })

  it("throws if the decided step id does not belong to the request", async () => {
    const request = {
      id: "req-1",
      currentStep: 1,
      submitterId: "submitter-1",
      steps: [{ id: "step-1", stepOrder: 1, status: "ACTIVE", workflowStep: baseWorkflowStep(1, "ANY") }],
      workflow: { steps: [baseWorkflowStep(1, "ANY")] },
    }
    const tx = makeTx(request)

    await expect(advanceRequest("req-1", "not-a-real-step", "APPROVED", "user-1", tx)).rejects.toThrow()
  })
})
