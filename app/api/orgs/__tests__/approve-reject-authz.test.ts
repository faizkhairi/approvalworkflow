import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }))
vi.mock("@/lib/db", () => ({
  db: {
    requestStep: { findFirst: vi.fn(), update: vi.fn() },
    request: { findUnique: vi.fn() },
    notification: { createMany: vi.fn() },
    $transaction: vi.fn(),
  },
}))
vi.mock("@/lib/workflow-engine", () => ({
  advanceRequest: vi.fn().mockResolvedValue({ newStatus: "APPROVED", notifyUserIds: [] }),
}))

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { POST as approvePost } from "@/app/api/orgs/[orgId]/requests/[requestId]/steps/[stepId]/approve/route"
import { POST as rejectPost } from "@/app/api/orgs/[orgId]/requests/[requestId]/steps/[stepId]/reject/route"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockAuth = vi.mocked(auth) as any
const mockStepFindFirst = vi.mocked(db.requestStep.findFirst)

function stepParams(orgId: string, requestId: string, stepId: string) {
  return { params: Promise.resolve({ orgId, requestId, stepId }) }
}

function jsonReq(body: unknown) {
  return new Request("http://test", { method: "POST", body: JSON.stringify(body) })
}

beforeEach(() => vi.clearAllMocks())

describe("POST .../steps/:stepId/approve", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await approvePost(jsonReq({}), stepParams("org-1", "req-1", "step-1"))
    expect(res.status).toBe(401)
  })

  it("scopes the step lookup to assignedTo=session user and status=ACTIVE", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never)
    mockStepFindFirst.mockResolvedValue(null)

    await approvePost(jsonReq({}), stepParams("org-1", "req-1", "step-1"))

    expect(mockStepFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "step-1", requestId: "req-1", assignedTo: "user-1", status: "ACTIVE" },
      }),
    )
  })

  it("returns 404 when the step is not assigned to the caller (foreign step id)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never)
    mockStepFindFirst.mockResolvedValue(null)

    const res = await approvePost(jsonReq({}), stepParams("org-1", "req-1", "not-assigned-to-me"))

    expect(res.status).toBe(404)
  })

  it("returns 403 when the step's request belongs to a different org than the URL", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never)
    mockStepFindFirst.mockResolvedValue({
      id: "step-1",
      requestId: "req-1",
      assignedTo: "user-1",
      status: "ACTIVE",
      request: { orgId: "org-owning-org" },
    } as never)

    const res = await approvePost(jsonReq({}), stepParams("org-not-owning-org", "req-1", "step-1"))

    expect(res.status).toBe(403)
  })

  it("approves when the step is assigned to the caller and matches the org", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never)
    mockStepFindFirst.mockResolvedValue({
      id: "step-1",
      requestId: "req-1",
      assignedTo: "user-1",
      status: "ACTIVE",
      request: { orgId: "org-1" },
    } as never)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(vi.mocked(db.$transaction) as any).mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        requestStep: { update: vi.fn().mockResolvedValue(undefined) },
      }),
    )

    const res = await approvePost(jsonReq({}), stepParams("org-1", "req-1", "step-1"))

    expect(res.status).toBe(200)
  })
})

describe("POST .../steps/:stepId/reject", () => {
  it("returns 400 when no comment is provided", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never)

    const res = await rejectPost(jsonReq({}), stepParams("org-1", "req-1", "step-1"))

    expect(res.status).toBe(400)
    expect(mockStepFindFirst).not.toHaveBeenCalled()
  })

  it("returns 404 for a step not assigned to the caller even with a valid comment", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never)
    mockStepFindFirst.mockResolvedValue(null)

    const res = await rejectPost(jsonReq({ comment: "Not approved" }), stepParams("org-1", "req-1", "not-mine"))

    expect(res.status).toBe(404)
  })
})
