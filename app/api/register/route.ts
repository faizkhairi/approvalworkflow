import { NextResponse } from "next/server"
import { hash } from "bcryptjs"
import { db } from "@/lib/db"
import { registerSchema } from "@/lib/validations"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = registerSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Validation error" },
        { status: 400 },
      )
    }

    const existing = await db.user.findUnique({ where: { email: parsed.data.email } })
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 },
      )
    }

    const hashedPassword = await hash(parsed.data.password, 12)
    await db.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        password: hashedPassword,
      },
    })

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    console.error("[register]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
