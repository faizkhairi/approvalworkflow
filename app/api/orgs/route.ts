import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { createOrgSchema } from "@/lib/validations"

// GET /api/orgs — list orgs the current user belongs to
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const memberships = await db.orgMember.findMany({
    where: { userId: session.user.id },
    include: {
      org: {
        include: {
          _count: { select: { members: true, workflows: true, requests: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  })

  return NextResponse.json(memberships.map((m) => ({ ...m.org, role: m.role })))
}

// POST /api/orgs — create a new org (current user becomes OWNER)
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const parsed = createOrgSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Validation error" }, { status: 400 })
  }

  const slugExists = await db.org.findUnique({ where: { slug: parsed.data.slug } })
  if (slugExists) {
    return NextResponse.json({ error: "This slug is already taken" }, { status: 409 })
  }

  const org = await db.$transaction(async (tx) => {
    const newOrg = await tx.org.create({
      data: { name: parsed.data.name, slug: parsed.data.slug },
    })
    await tx.orgMember.create({
      data: { orgId: newOrg.id, userId: session.user!.id, role: "OWNER" },
    })
    return newOrg
  })

  return NextResponse.json(org, { status: 201 })
}
