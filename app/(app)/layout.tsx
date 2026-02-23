import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { AppSidebar } from "@/components/app-sidebar"

// This layout wraps all protected app pages. The middleware already redirects
// unauthenticated users, but we double-check here for type safety.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const memberships = await db.orgMember.findMany({
    where: { userId: session.user.id },
    include: { org: true },
    orderBy: { createdAt: "asc" },
  })

  const orgs = memberships.map((m) => ({ ...m.org, role: m.role }))

  // Default active org: first org the user belongs to
  const activeOrgId = orgs[0]?.id

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      <AppSidebar
        user={session.user}
        orgs={orgs}
        activeOrgId={activeOrgId}
      />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-6 py-8">
          {children}
        </div>
      </main>
    </div>
  )
}
