import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"

// Root route: redirect authenticated users to dashboard, others to login.
export default async function HomePage() {
  const session = await auth()
  redirect(session ? "/dashboard" : "/login")
}
