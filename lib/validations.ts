import { z } from "zod"

// ─── Auth ────────────────────────────────────────────────────────────────────

export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
})

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
})

// ─── Org ─────────────────────────────────────────────────────────────────────

export const createOrgSchema = z.object({
  name: z.string().min(2, "Org name must be at least 2 characters"),
  slug: z
    .string()
    .min(2)
    .max(32)
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"),
})

export const inviteMemberSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
})

// ─── Workflow ─────────────────────────────────────────────────────────────────

export const formFieldSchema = z.object({
  id: z.string(),
  label: z.string().min(1),
  type: z.enum(["text", "textarea", "number", "date", "select"]),
  required: z.boolean().default(false),
  options: z.array(z.string()).optional(), // for "select" type
  placeholder: z.string().optional(),
})

export const workflowStepSchema = z.object({
  order: z.number().int().positive(),
  name: z.string().min(1, "Step name is required"),
  approvalMode: z.enum(["ANY", "ALL"]).default("ANY"),
  approverType: z.enum(["USER", "ROLE"]).default("USER"),
  approverIds: z.array(z.string()).min(1, "At least one approver is required"),
  timeoutHours: z.number().int().positive().nullable().optional(),
  timeoutAction: z.enum(["ESCALATE", "AUTO_APPROVE", "AUTO_REJECT"]).default("ESCALATE"),
  escalateTo: z.string().nullable().optional(),
})

export const createWorkflowSchema = z.object({
  name: z.string().min(1, "Workflow name is required"),
  description: z.string().optional(),
  category: z.string().optional(),
  formSchema: z.array(formFieldSchema).default([]),
  steps: z.array(workflowStepSchema).min(1, "At least one step is required"),
})

export const updateWorkflowSchema = createWorkflowSchema.partial()

// ─── Request ─────────────────────────────────────────────────────────────────

export const createRequestSchema = z.object({
  workflowId: z.string().cuid(),
  title: z.string().min(1, "Request title is required"),
  formData: z.record(z.string(), z.unknown()).default({}), // Zod v4: z.record requires key + value args
})

export const cancelRequestSchema = z.object({
  reason: z.string().optional(),
})

// ─── Approval Actions ─────────────────────────────────────────────────────────

export const approveStepSchema = z.object({
  comment: z.string().optional(),
})

export const rejectStepSchema = z.object({
  comment: z.string().min(1, "A comment is required when rejecting a request"),
})

// ─── Notifications ───────────────────────────────────────────────────────────

export type FormField = z.infer<typeof formFieldSchema>
export type WorkflowStepInput = z.infer<typeof workflowStepSchema>
export type CreateWorkflowInput = z.infer<typeof createWorkflowSchema>
export type CreateRequestInput = z.infer<typeof createRequestSchema>
