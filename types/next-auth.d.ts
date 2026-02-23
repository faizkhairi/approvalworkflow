import type { DefaultSession } from "next-auth"

// Augment NextAuth's Session type so session.user.id is always string (not string | undefined).
// This is safe because our JWT callback always sets token.sub = user.id on login,
// and the session callback always copies token.sub → session.user.id.
declare module "next-auth" {
  interface Session {
    user: {
      id: string
    } & DefaultSession["user"]
  }

  interface User {
    id: string
  }
}
