import type { ReactNode } from "react"

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <div className="flex min-h-svh items-center justify-center px-4 py-10 sm:px-8">
      <div className="w-full max-w-sm">
        <div className="rounded-lg border border-line bg-surface p-6 sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight text-fg">{title}</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">{subtitle}</p>
          <div className="mt-7">{children}</div>
        </div>
      </div>
    </div>
  )
}
