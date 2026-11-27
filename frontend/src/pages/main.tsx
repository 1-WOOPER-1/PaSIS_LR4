import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router"
import {
  Check,
  CircleAlert,
  Hash,
  LoaderCircle,
  Lock,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react"
import { Alert, Avatar, EmptyState, RoleBadge } from "../components/ui"
import { ApiError, apiRequest } from "../lib/api"
import { cn } from "../lib/cn"

const ROLES = ["user", "moderator", "admin"] as const
type Role = (typeof ROLES)[number]

const ROLE_DETAILS: Record<Role, { label: string; description: string }> = {
  user: {
    label: "Пользователь",
    description: "Профиль и базовый доступ",
  },
  moderator: {
    label: "Модератор",
    description: "Просмотр списка пользователей",
  },
  admin: {
    label: "Администратор",
    description: "Полное управление доступом",
  },
}

const PERMISSION_LABELS: Record<string, string> = {
  "profile.read": "Просмотр профиля",
  "users.read": "Список пользователей",
  "users.manage": "Управление пользователями",
  "roles.manage": "Управление ролями",
}

interface User {
  id: number
  login: string
  roles: string[]
  permissions: string[]
}

interface UserItem {
  id: number
  login: string
}

export function Main() {
  const [user, setUser] = useState<User | null>(null)
  const [users, setUsers] = useState<UserItem[]>([])
  const [selectedUser, setSelectedUser] = useState<number | null>(null)
  const [selectedRole, setSelectedRole] = useState<Role>("user")

  const [info, setInfo] = useState("")
  const [error, setError] = useState("")
  const [usersError, setUsersError] = useState("")
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [granting, setGranting] = useState(false)

  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"))

  const navigate = useNavigate()
  const rolePanelRef = useRef<HTMLElement | null>(null)

  const canReadUsers = user?.permissions.includes("users.read") ?? false
  const canManageRoles = user?.permissions.includes("roles.manage") ?? false

  const target = users.find((item) => item.id === selectedUser) ?? null

  const logout = useCallback(() => {
    localStorage.removeItem("token")
    setToken(null)
    navigate("/login", { replace: true })
  }, [navigate])

  function selectUser(id: number) {
    setSelectedUser(id)
    setInfo("")
    setError("")

    if (window.matchMedia("(max-width: 1023px)").matches) {
      window.requestAnimationFrame(() => {
        rolePanelRef.current?.scrollIntoView({ behavior: "auto", block: "start" })
      })
    }
  }

  const loadUsers = useCallback(async () => {
    if (!token) return

    setLoadingUsers(true)
    setUsersError("")

    try {
      const data = await apiRequest<UserItem[]>("/api/users", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      setUsers(data)
    } catch (e) {
      setUsersError(
        e instanceof Error ? e.message : "Не удалось загрузить список пользователей.",
      )
    } finally {
      setLoadingUsers(false)
    }
  }, [token])

  async function handleChangeRole() {
    if (!token || !selectedUser) return

    setGranting(true)
    setInfo("")
    setError("")

    try {
      await apiRequest(`/api/users/${selectedUser}/roles/${selectedRole}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          target_user_id: selectedUser,
          role_name: selectedRole,
        }),
      })

      setInfo(
        `Роль «${ROLE_DETAILS[selectedRole].label}» назначена пользователю ${
          target?.login ?? selectedUser
        }.`,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось изменить роль.")
    } finally {
      setGranting(false)
    }
  }

  useEffect(() => {
    if (!token) {
      navigate("/login", { replace: true })
      return
    }

    let cancelled = false

    ;(async () => {
      try {
        const data = await apiRequest<User>("/api/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
        if (!cancelled) setUser(data)
      } catch (e) {
        if (cancelled) return

        setError(e instanceof Error ? e.message : "Не удалось загрузить профиль.")

        if (e instanceof ApiError && e.status === 401) {
          localStorage.removeItem("token")
          setToken(null)
          navigate("/login", { replace: true })
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [token, navigate])

  useEffect(() => {
    if (canReadUsers) void loadUsers()
  }, [canReadUsers, loadUsers])

  if (!user) {
    return (
      <div className="grid min-h-svh place-items-center px-4">
        <div className="w-full max-w-sm text-center">
          {error ? (
            <>
              <p className="flex items-center justify-center gap-2 text-lg font-semibold text-fg">
                <CircleAlert className="size-5 text-rose-600 dark:text-rose-300" />
                Не удалось загрузить профиль
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{error}</p>
              <button type="button" className="btn-primary mt-5" onClick={logout}>
                Вернуться ко входу
              </button>
            </>
          ) : (
            <p className="flex items-center justify-center gap-2 text-sm text-muted">
              <LoaderCircle className="size-4 animate-spin" />
              Загружаем профиль…
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-svh">
      <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
            Панель управления доступом
          </h1>
          <button type="button" className="btn-secondary shrink-0" onClick={logout}>
            <LogOut className="size-4" />
            Выйти
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-6">
            <section className="panel p-6 sm:p-8">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <Avatar login={user.login} size="lg" />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
                    Добро пожаловать, {user.login}
                  </h2>
                  <p className="mt-1 max-w-lg text-sm leading-relaxed text-muted">
                    Вы вошли в систему управления доступом. Здесь можно просматривать профиль и
                    назначать роли пользователям.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-xs font-medium text-muted">
                      <Hash className="size-3" />
                      ID {user.id}
                    </span>
                    {user.roles.map((role) => (
                      <RoleBadge key={role} role={role} />
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 border-t border-line pt-5">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Разрешения
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {user.permissions.map((permission) => (
                    <span
                      key={permission}
                      title={permission}
                      className="inline-flex items-center rounded-lg border border-line bg-surface-2 px-2.5 py-1 text-xs text-fg"
                    >
                      {PERMISSION_LABELS[permission] ?? permission}
                    </span>
                  ))}
                  {user.permissions.length === 0 && (
                    <span className="text-xs text-muted">Нет активных разрешений.</span>
                  )}
                </div>
              </div>
            </section>

            <section className="panel overflow-hidden">
              <div className="flex flex-col gap-3 border-b border-line p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-fg">Пользователи</h2>
                  <p className="mt-0.5 text-xs text-muted">
                    {users.length > 0
                      ? `Всего учётных записей: ${users.length}`
                      : "Список учётных записей системы"}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="btn-secondary size-10 shrink-0 px-0"
                    onClick={loadUsers}
                    disabled={loadingUsers || !canReadUsers}
                    aria-label="Обновить список пользователей"
                    title="Обновить список"
                  >
                    <RefreshCw className={cn("size-4", loadingUsers && "animate-spin")} />
                  </button>
                </div>
              </div>

              <div className="p-3 sm:p-4">
                {!canReadUsers ? (
                  <EmptyState
                    icon={Lock}
                    title="Недостаточно прав"
                    text="Для просмотра списка пользователей нужна роль модератора или администратора."
                  />
                ) : usersError ? (
                  <Alert tone="error">{usersError}</Alert>
                ) : loadingUsers && users.length === 0 ? (
                  <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted">
                    <LoaderCircle className="size-4 animate-spin" />
                    Загружаем пользователей…
                  </div>
                ) : users.length === 0 ? (
                  <EmptyState
                    icon={Users}
                    title="Список пуст"
                    text="В системе пока нет зарегистрированных пользователей."
                  />
                ) : (
                  <ul className="space-y-1">
                    {users.map((item) => {
                      const active = item.id === selectedUser

                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => selectUser(item.id)}
                            className={cn(
                              "flex w-full items-center gap-3 rounded-lg border p-3 text-left",
                              active ? "border-accent bg-accent-soft" : "border-line",
                            )}
                          >
                            <Avatar login={item.login} size="sm" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold text-fg">
                                {item.login}
                              </span>
                              <span className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                                <Hash className="size-3" />
                                {item.id}
                              </span>
                            </span>
                            {active && <Check className="size-4 shrink-0 text-accent" />}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section
              ref={rolePanelRef}
              className="panel scroll-mt-24 p-5 lg:sticky lg:top-24"
            >
              <div>
                <h2 className="text-base font-semibold text-fg">Управление ролями</h2>
                <p className="text-xs text-muted">Назначение прав доступа</p>
              </div>

              {!canManageRoles ? (
                <Alert tone="info" className="mt-5">
                  Управление ролями доступно только администратору.
                </Alert>
              ) : (
                <>
                  <div className="mt-5 rounded-lg border border-line bg-surface-2 p-3">
                    {target ? (
                      <div className="flex items-center gap-3">
                        <Avatar login={target.login} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-fg">
                            {target.login}
                          </p>
                          <p className="flex items-center gap-1 text-xs text-muted">
                            <Hash className="size-3" />
                            {target.id}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedUser(null)
                            setInfo("")
                            setError("")
                          }}
                          className="rounded-lg px-2 py-1 text-xs font-medium text-muted hover:bg-surface hover:text-fg"
                        >
                          Сбросить
                        </button>
                      </div>
                    ) : (
                      <p className="px-1 py-2 text-center text-xs leading-relaxed text-muted">
                        Выберите пользователя из списка, чтобы назначить ему роль.
                      </p>
                    )}
                  </div>

                  <div className="mt-4 space-y-2" role="radiogroup" aria-label="Выбор роли">
                    {ROLES.map((role) => {
                      const meta = ROLE_DETAILS[role]
                      const active = selectedRole === role

                      return (
                        <button
                          key={role}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => setSelectedRole(role)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-lg border p-3 text-left",
                            active ? "border-accent bg-accent-soft" : "border-line bg-surface",
                          )}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-fg">
                              {meta.label}
                            </span>
                            <span className="block text-xs text-muted">
                              {meta.description}
                            </span>
                          </span>
                          {active && <Check className="size-4 shrink-0 text-accent" />}
                        </button>
                      )
                    })}
                  </div>

                  <button
                    type="button"
                    className="btn-primary mt-4 w-full"
                    onClick={handleChangeRole}
                    disabled={!target || granting}
                  >
                    {granting ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="size-4" />
                    )}
                    {granting ? "Назначаем…" : "Назначить роль"}
                  </button>
                </>
              )}

              {info && (
                <Alert tone="success" className="mt-3">
                  {info}
                </Alert>
              )}
              {error && (
                <Alert tone="error" className="mt-3">
                  {error}
                </Alert>
              )}
            </section>
          </aside>
        </div>
      </main>
    </div>
  )
}
