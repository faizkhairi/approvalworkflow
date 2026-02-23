import { redirect } from "next/navigation"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatDistanceToNow } from "date-fns"
import type { Metadata } from "next"

export const metadata: Metadata = { title: "Dashboard" }

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const memberships = await db.orgMember.findMany({
    where: { userId: session.user.id },
    include: { org: true },
  })

  if (memberships.length === 0) {
    // First-time user — nudge to create an org
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-900 dark:bg-zinc-100 mb-4">
          <span className="text-2xl font-bold text-white dark:text-zinc-900">A</span>
        </div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Welcome to ApprovalKit
        </h1>
        <p className="mt-2 max-w-sm text-sm text-zinc-500">
          Create your first organization to start building approval workflows for your team.
        </p>
        <Button asChild className="mt-6">
          <Link href="/orgs/new">Create organization</Link>
        </Button>
      </div>
    )
  }

  const orgIds = memberships.map((m) => m.orgId)

  // Stats
  const [pendingCount, myPendingCount, recentRequests] = await Promise.all([
    db.requestStep.count({
      where: {
        assignedTo: session.user.id,
        status: "ACTIVE",
        request: { orgId: { in: orgIds } },
      },
    }),
    db.request.count({
      where: { submitterId: session.user.id, status: { in: ["IN_PROGRESS", "PENDING"] } },
    }),
    db.request.findMany({
      where: { orgId: { in: orgIds } },
      include: {
        workflow: { select: { name: true } },
        submitter: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ])

  const approvedCount = await db.request.count({
    where: { orgId: { in: orgIds }, status: "APPROVED" },
  })

  const statusColors: Record<string, string> = {
    PENDING: "bg-zinc-100 text-zinc-600",
    IN_PROGRESS: "bg-amber-50 text-amber-700",
    APPROVED: "bg-emerald-50 text-emerald-700",
    REJECTED: "bg-red-50 text-red-700",
    CANCELLED: "bg-zinc-100 text-zinc-500",
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Dashboard</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Welcome back, {session.user.name?.split(" ")[0] ?? "there"}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-500">Awaiting my approval</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">{pendingCount}</div>
            {pendingCount > 0 && (
              <Link
                href={`/orgs/${memberships[0].orgId}/inbox`}
                className="mt-1 text-xs text-amber-600 hover:underline"
              >
                Go to inbox →
              </Link>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-500">My active requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">{myPendingCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-500">Total approved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">{approvedCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Recent requests */}
      <div>
        <h2 className="mb-3 text-base font-semibold text-zinc-900 dark:text-zinc-50">Recent requests</h2>
        {recentRequests.length === 0 ? (
          <p className="text-sm text-zinc-400">No requests yet.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-900">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-zinc-500">Request</th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-500">Workflow</th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-500">Submitter</th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-500">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-500">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {recentRequests.map((req) => (
                  <tr key={req.id} className="bg-white hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900">
                    <td className="px-4 py-3">
                      <Link
                        href={`/orgs/${req.orgId}/requests/${req.id}`}
                        className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                      >
                        {req.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-zinc-500">{req.workflow.name}</td>
                    <td className="px-4 py-3 text-zinc-500">{req.submitter.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[req.status] ?? "bg-zinc-100 text-zinc-600"}`}
                      >
                        {req.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">
                      {formatDistanceToNow(req.createdAt, { addSuffix: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
