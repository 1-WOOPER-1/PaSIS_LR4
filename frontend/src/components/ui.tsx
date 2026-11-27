import type { ReactNode } from "react"
import { CircleAlert, CircleCheck, Info } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { cn } from "../lib/cn"

const AVATAR_COLORS = [
  "bg-violet-500",
  "bg-sky-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-fuchsia-500",
]

const AVATAR_SIZES = {
  sm: "size-8 rounded-lg text-[11px]",
  md: "size-10 rounded-lg text-sm",
  lg: "size-12 rounded-lg text-base",
}

export function Avatar({
  login,
  size = "md",
  className,
}: {
  login: string
  size?: keyof typeof AVATAR_SIZES
  className?: string
}) {
  const hash = [...login].reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const color = AVATAR_COLORS[hash % AVATAR_COLORS.length]
  const initials = login.slice(0, 2).toUpperCase()

  return (
    <div
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center border border-white/10 font-semibold text-white",
        color,
        AVATAR_SIZES[size],
        className,
      )}
    >
      {initials}
    </div>
  )
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Администратор",
  moderator: "Модератор",
  user: "Пользователь",
}

const ROLE_STYLES: Record<string, string> = {
  admin: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  moderator: "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  user: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
}

export function RoleBadge({ role }: { role: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-medium",
        ROLE_STYLES[role] ??
          "border-slate-500/20 bg-slate-500/10 text-slate-600 dark:text-slate-300",
      )}
    >
      {ROLE_LABELS[role] ?? role}
    </span>
  )
}

const ALERT_STYLES = {
  success: {
    box: "border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
    icon: CircleCheck,
  },
  error: {
    box: "border-rose-500/25 bg-rose-500/10 text-rose-800 dark:text-rose-200",
    icon: CircleAlert,
  },
  info: {
    box: "border-sky-500/25 bg-sky-500/10 text-sky-800 dark:text-sky-200",
    icon: Info,
  },
} as const

export function Alert({
  tone = "error",
  children,
  className,
}: {
  tone?: keyof typeof ALERT_STYLES
  children: ReactNode
  className?: string
}) {
  const style = ALERT_STYLES[tone]
  const AlertIcon = style.icon

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm leading-snug",
        style.box,
        className,
      )}
    >
      <AlertIcon className="mt-0.5 size-4 shrink-0" />
      <span className="min-w-0">{children}</span>
    </div>
  )
}

export function EmptyState({
  icon: EmptyIcon,
  title,
  text,
}: {
  icon: LucideIcon
  title: string
  text: string
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
      <span className="grid size-10 place-items-center rounded-lg bg-surface-2 text-muted">
        <EmptyIcon className="size-5" />
      </span>
      <div>
        <p className="text-sm font-semibold text-fg">{title}</p>
        <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-muted">{text}</p>
      </div>
    </div>
  )
}
