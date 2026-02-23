import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/notifications — paginated list for the current user
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const cursor = searchParams.get("cursor")
  const limit = 20

  const notifications = await db.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
  })

  const hasMore = notifications.length > limit
  const data = hasMore ? notifications.slice(0, limit) : notifications

  return NextResponse.json({
    notifications: data,
    nextCursor: hasMore ? data[data.length - 1].id : null,
  })
}

// PATCH /api/notifications — mark all as read
export async function PATCH() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await db.notification.updateMany({
    where: { userId: session.user.id, isRead: false },
    data: { isRead: true },
  })

  return NextResponse.json({ success: true })
}
