import { useState } from "react"
import type { FormEvent } from "react"
import { Link, useNavigate } from "react-router"
import { AuthLayout } from "../components/auth-layout"
import { Alert } from "../components/ui"
import { cn } from "../lib/cn"
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  LoaderCircle,
  Lock,
  UserPlus,
  UserRound,
} from "lucide-react"
import { apiRequest } from "../lib/api"

export function Register() {
  const [login, setLogin] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const navigate = useNavigate()

  const passwordRules = [
    { label: "Минимум 8 символов", ok: password.length >= 8 },
    {
      label: "Заглавная и строчная буквы",
      ok: /[A-Z]/.test(password) && /[a-z]/.test(password),
    },
    { label: "Хотя бы одна цифра", ok: /\d/.test(password) },
    { label: "Специальный символ", ok: /[^A-Za-z0-9\s]/.test(password) },
  ]
  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      await apiRequest("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ login, password }),
      })

      navigate("/login", { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось создать аккаунт.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Создать аккаунт"
      subtitle="Зарегистрируйтесь, чтобы получить доступ к панели управления."
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="space-y-1.5">
          <label htmlFor="login" className="text-sm font-medium text-fg">
            Логин
          </label>
          <div className="relative">
            <UserRound className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              id="login"
              name="login"
              type="text"
              autoComplete="username"
              placeholder="your.login"
              className="field"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              minLength={3}
              maxLength={32}
              pattern="[A-Za-z0-9_.\-]{3,32}"
              title="3–32 символа: латинские буквы, цифры, точка, подчёркивание или дефис."
              required
            />
          </div>
          <p className="text-[11px] leading-relaxed text-muted">
            3–32 символа: латинские буквы, цифры, точка, подчёркивание или дефис.
          </p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="text-sm font-medium text-fg">
            Пароль
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Придумайте пароль"
              className="field pr-11"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
              className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>

          <ul className="grid gap-1.5 pt-1 sm:grid-cols-2">
            {passwordRules.map((rule) => (
              <li
                key={rule.label}
                className={cn(
                  "flex items-center gap-1.5 text-[11px]",
                  rule.ok ? "text-emerald-600 dark:text-emerald-400" : "text-muted",
                )}
              >
                <span
                  className={cn(
                    "grid size-3.5 shrink-0 place-items-center rounded-full border",
                    rule.ok ? "border-emerald-500/40 bg-emerald-500/10" : "border-line",
                  )}
                >
                  {rule.ok && <Check className="size-2.5" />}
                </span>
                {rule.label}
              </li>
            ))}
          </ul>
        </div>

        {error && <Alert tone="error">{error}</Alert>}

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <UserPlus className="size-4" />
          )}
          {loading ? "Создаём аккаунт…" : "Зарегистрироваться"}
          {!loading && <ArrowRight className="ml-auto size-4 opacity-70" />}
        </button>

        <p className="text-center text-sm text-muted">
          Уже есть аккаунт?{" "}
          <Link
            to="/login"
            className="font-semibold text-accent hover:text-accent-hover"
          >
            Войти
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
