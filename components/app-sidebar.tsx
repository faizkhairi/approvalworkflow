"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import {
  LayoutDashboard,
  Inbox,
  ClipboardList,
  GitBranch,
  Users,
  Bell,
  LogOut,
  ChevronDown,
  Plus,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type Org = { id: string; name: string; slug: string; role: string }
type User = { id: string; name?: string | null; email?: string | null; image?: string | null }

type Props = {
  user: User
  orgs: Org[]
  activeOrgId?: string
}

const navItems = (orgId: string | undefined) =>
  orgId
    ? [
        { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { href: `/orgs/${orgId}/inbox`, label: "Inbox", icon: Inbox },
        { href: `/orgs/${orgId}/requests`, label: "My Requests", icon: ClipboardList },
        { href: `/orgs/${orgId}/workflows`, label: "Workflows", icon: GitBranch },
        { href: `/orgs/${orgId}/members`, label: "Members", icon: Users },
      ]
    : [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }]

export function AppSidebar({ user, orgs, activeOrgId }: Props) {
  const pathname = usePathname()
  const [unreadCount, setUnreadCount] = useState(0)
  const activeOrg = orgs.find((o) => o.id === activeOrgId)

  // Poll unread notification count every 30 seconds
  useEffect(() => {
    async function fetchUnread() {
      try {
        const res = await fetch("/api/notifications/unread")
        if (res.ok) {
          const data = await res.json()
          setUnreadCount(data.count)
        }
      } catch {}
    }
    fetchUnread()
    const interval = setInterval(fetchUnread, 30_000)
    return () => clearInterval(interval)
  }, [])

  const initials = (user.name ?? user.email ?? "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      {/* Org switcher */}
      <div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
        {orgs.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="w-full justify-between px-2 font-semibold">
                <span className="truncate">{activeOrg?.name ?? "Select org"}</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              {orgs.map((org) => (
                <DropdownMenuItem key={org.id} asChild>
                  <Link href={`/orgs/${org.id}`}>{org.name}</Link>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/orgs/new">
                  <Plus className="mr-2 h-4 w-4" />
                  New organization
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Link
            href="/orgs/new"
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            <Plus className="h-4 w-4" />
            Create organization
          </Link>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {navItems(activeOrgId).map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/")
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                  : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-50",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{label}</span>
              {label === "Inbox" && unreadCount > 0 && (
                <Badge variant="destructive" className="h-5 min-w-5 justify-center px-1 text-xs">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </Badge>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Notification bell + user menu */}
      <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full justify-start gap-2.5 px-2.5 py-2 h-auto">
              <Avatar className="h-7 w-7">
                <AvatarImage src={user.image ?? undefined} />
                <AvatarFallback className="text-xs bg-zinc-200 dark:bg-zinc-700">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex flex-1 flex-col items-start overflow-hidden">
                <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  {user.name ?? "Unknown"}
                </span>
                <span className="truncate text-xs text-zinc-400">{user.email}</span>
              </div>
              {unreadCount > 0 && (
                <Bell className="h-4 w-4 shrink-0 text-amber-500" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" className="w-56">
            <DropdownMenuItem asChild>
              <Link href="/notifications">
                <Bell className="mr-2 h-4 w-4" />
                Notifications
                {unreadCount > 0 && (
                  <Badge variant="destructive" className="ml-auto h-5 min-w-5 justify-center px-1 text-xs">
                    {unreadCount}
                  </Badge>
                )}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  )
}
