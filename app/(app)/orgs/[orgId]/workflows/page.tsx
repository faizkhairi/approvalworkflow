import { redirect } from "next/navigation"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, GitBranch } from "lucide-react"
import type { Metadata } from "next"

export const metadata: Metadata = { title: "Workflows" }

type Params = { params: Promise<{ orgId: string }> }

export default async function WorkflowsPage({ params }: Params) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { orgId } = await params

  const member = await db.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId: session.user.id } },
    include: { org: true },
  })
  if (!member) redirect("/dashboard")

  const workflows = await db.workflow.findMany({
    where: { orgId },
    include: { _count: { select: { steps: true, requests: true } } },
    orderBy: { createdAt: "desc" },
  })

  const isAdmin = ["OWNER", "ADMIN"].includes(member.role)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Workflows</h1>
          <p className="text-sm text-zinc-500 mt-1">{member.org.name}</p>
        </div>
        {isAdmin && (
          <Button asChild>
            <Link href={`/orgs/${orgId}/workflows/new`}>
              <Plus className="mr-2 h-4 w-4" />
              New workflow
            </Link>
          </Button>
        )}
      </div>

      {workflows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-200 py-16 text-center dark:border-zinc-800">
          <GitBranch className="h-10 w-10 text-zinc-300 dark:text-zinc-600 mb-3" />
          <p className="text-sm font-medium text-zinc-500">No workflows yet</p>
          {isAdmin && (
            <Button asChild size="sm" className="mt-4">
              <Link href={`/orgs/${orgId}/workflows/new`}>Create your first workflow</Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {workflows.map((workflow) => (
            <Card key={workflow.id} className="hover:shadow-sm transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{workflow.name}</CardTitle>
                  <Badge variant={workflow.isActive ? "default" : "secondary"}>
                    {workflow.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                {workflow.description && (
                  <CardDescription className="line-clamp-2">{workflow.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>
                    {workflow._count.steps} step{workflow._count.steps !== 1 ? "s" : ""} ·{" "}
                    {workflow._count.requests} request{workflow._count.requests !== 1 ? "s" : ""}
                  </span>
                  <Link
                    href={`/orgs/${orgId}/requests/new?workflowId=${workflow.id}`}
                    className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                  >
                    Submit request →
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
