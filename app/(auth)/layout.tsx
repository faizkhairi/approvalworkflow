export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 dark:bg-zinc-100 mb-3">
            <span className="text-lg font-bold text-white dark:text-zinc-900">A</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            ApprovalKit
          </h1>
          <p className="text-sm text-zinc-500 mt-1">Multi-step approval workflows for teams</p>
        </div>
        {children}
      </div>
    </div>
  )
}
