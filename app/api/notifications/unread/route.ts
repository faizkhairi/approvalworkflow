import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/notifications/unread — returns the unread count.
// Used by the notification bell which polls every 30 seconds.
// Returns { count: number } — lightweight endpoint, no notification bodies.
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const count = await db.notification.count({
    where: { userId: session.user.id, isRead: false },
  })

  return NextResponse.json({ count })
}
