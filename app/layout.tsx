import type { Metadata } from "next"
import { Geist } from "next/font/google"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css"

const geist = Geist({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: { default: "ApprovalKit", template: "%s · ApprovalKit" },
  description: "Multi-step approval workflows for teams — configurable, auditable, and fast.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geist.className} antialiased`}>
        {children}
        <Toaster richColors closeButton />
      </body>
    </html>
  )
}
