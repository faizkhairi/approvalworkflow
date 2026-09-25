import { describe, it, expect } from "vitest"
import {
  registerSchema,
  createOrgSchema,
  workflowStepSchema,
  createWorkflowSchema,
  approveStepSchema,
  rejectStepSchema,
} from "@/lib/validations"

describe("registerSchema", () => {
  it("rejects a password missing a required number", () => {
    const result = registerSchema.safeParse({ name: "Bo", email: "b@x.com", password: "Password" })
    expect(result.success).toBe(false)
  })

  it("accepts a valid payload", () => {
    const result = registerSchema.safeParse({ name: "Bo", email: "b@x.com", password: "Passw0rd" })
    expect(result.success).toBe(true)
  })
})

describe("createOrgSchema", () => {
  it("rejects a slug with uppercase letters", () => {
    const result = createOrgSchema.safeParse({ name: "Acme", slug: "Acme-Corp" })
    expect(result.success).toBe(false)
  })

  it("rejects a slug with spaces", () => {
    const result = createOrgSchema.safeParse({ name: "Acme", slug: "acme corp" })
    expect(result.success).toBe(false)
  })

  it("accepts a lowercase hyphenated slug", () => {
    const result = createOrgSchema.safeParse({ name: "Acme", slug: "acme-corp" })
    expect(result.success).toBe(true)
  })
})

describe("workflowStepSchema", () => {
  it("defaults approvalMode to ANY", () => {
    const result = workflowStepSchema.parse({ order: 1, name: "Manager", approverIds: ["user-1"] })
    expect(result.approvalMode).toBe("ANY")
  })

  it("requires at least one approver", () => {
    const result = workflowStepSchema.safeParse({ order: 1, name: "Manager", approverIds: [] })
    expect(result.success).toBe(false)
  })
})

describe("createWorkflowSchema", () => {
  it("requires at least one step", () => {
    const result = createWorkflowSchema.safeParse({ name: "Leave Request", steps: [] })
    expect(result.success).toBe(false)
  })

  it("accepts a workflow with one valid step", () => {
    const result = createWorkflowSchema.safeParse({
      name: "Leave Request",
      steps: [{ order: 1, name: "Manager", approverIds: ["user-1"] }],
    })
    expect(result.success).toBe(true)
  })
})

describe("approveStepSchema / rejectStepSchema", () => {
  it("approve allows an empty payload (comment optional)", () => {
    const result = approveStepSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it("reject requires a non-empty comment", () => {
    const result = rejectStepSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it("reject accepts a payload with a comment", () => {
    const result = rejectStepSchema.safeParse({ comment: "Budget exceeded" })
    expect(result.success).toBe(true)
  })
})
