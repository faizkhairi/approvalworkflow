import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }))
vi.mock("@/lib/db", () => ({
  db: {
    orgMember: { findUnique: vi.fn() },
    request: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    workflow: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}))
vi.mock("@/lib/workflow-engine", () => ({
  initializeRequestSteps: vi.fn(),
  advanceRequest: vi.fn(),
}))

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { GET, POST } from "@/app/api/orgs/[orgId]/requests/route"
import { PATCH } from "@/app/api/orgs/[orgId]/requests/[requestId]/route"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockAuth = vi.mocked(auth) as any
const mockOrgMember = vi.mocked(db.orgMember.findUnique)
const mockRequestFindFirst = vi.mocked(db.request.findFirst)

function orgParams(orgId: string) {
  return { params: Promise.resolve({ orgId }) }
}
function requestParams(orgId: string, requestId: string) {
  return { params: Promise.resolve({ orgId, requestId }) }
}

beforeEach(() => vi.clearAllMocks())

describe("GET /api/orgs/:orgId/requests", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await GET(new Request("http://test"), orgParams("org-1"))
    expect(res.status).toBe(401)
  })

  it("returns 403 when the session user is not a member of the org", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never)
    mockOrgMember.mockResolvedValue(null)

    const res = await GET(new Request("http://test"), orgParams("org-not-mine"))

    expect(res.status).toBe(403)
    expect(mockOrgMember).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orgId_userId: { orgId: "org-not-mine", userId: "user-1" } } }),
    )
  })

  it("scopes the list query to the given orgId once membership is confirmed", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never)
    mockOrgMember.mockResolvedValue({ id: "m-1", orgId: "org-1", userId: "user-1", role: "MEMBER" } as never)
    vi.mocked(db.request.findMany).mockResolvedValue([] as never)

    await GET(new Request("http://test"), orgParams("org-1"))

    expect(db.request.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ orgId: "org-1" }) }),
    )
  })
})

describe("POST /api/orgs/:orgId/requests", () => {
  it("returns 403 without creating a request when the user is not an org member", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never)
    mockOrgMember.mockResolvedValue(null)

    const res = await POST(
      new Request("http://test", { method: "POST", body: JSON.stringify({ workflowId: "c123", title: "x" }) }),
      orgParams("org-not-mine"),
    )

    expect(res.status).toBe(403)
    expect(db.request.create).not.toHaveBeenCalled()
  })
})

describe("PATCH /api/orgs/:orgId/requests/:requestId (cancel)", () => {
  it("returns 404 for a request that does not belong to this org", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never)
    mockRequestFindFirst.mockResolvedValue(null)

    const res = await PATCH(
      new Request("http://test", { method: "PATCH", body: "{}" }),
      requestParams("org-1", "req-in-another-org"),
    )

    expect(res.status).toBe(404)
  })

  it("returns 403 when the session user did not submit the request", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-2" } } as never)
    mockRequestFindFirst.mockResolvedValue({
      id: "req-1",
      orgId: "org-1",
      submitterId: "user-1",
      status: "PENDING",
    } as never)

    const res = await PATCH(
      new Request("http://test", { method: "PATCH", body: "{}" }),
      requestParams("org-1", "req-1"),
    )

    expect(res.status).toBe(403)
  })

  it("allows the original submitter to cancel their own pending request", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never)
    mockRequestFindFirst.mockResolvedValue({
      id: "req-1",
      orgId: "org-1",
      submitterId: "user-1",
      status: "PENDING",
    } as never)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(vi.mocked(db.$transaction) as any).mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        request: { update: vi.fn().mockResolvedValue({ id: "req-1", status: "CANCELLED" }) },
        auditLog: { create: vi.fn() },
      }),
    )

    const res = await PATCH(
      new Request("http://test", { method: "PATCH", body: "{}" }),
      requestParams("org-1", "req-1"),
    )

    expect(res.status).toBe(200)
  })
})
