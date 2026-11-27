import { useState } from "react"
import type { FormEvent } from "react"
import { Link, useNavigate } from "react-router"
import { AuthLayout } from "../components/auth-layout"
import { Alert } from "../components/ui"
import { ArrowRight, Eye, EyeOff, LoaderCircle, Lock, UserRound } from "lucide-react"
import { apiRequest } from "../lib/api"

export function Login() {
  const [login, setLogin] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const navigate = useNavigate()

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const data = await apiRequest<{ access_token: string; token_type: string }>(
        "/api/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ login, password }),
        },
      )

      localStorage.setItem("token", data.access_token)
      navigate("/", { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось выполнить вход.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="С возвращением"
      subtitle="Войдите, чтобы продолжить работу с панелью управления доступом."
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
              required
            />
          </div>
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
              autoComplete="current-password"
              placeholder="••••••••"
              className="field pr-11"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
        </div>

        {error && <Alert tone="error">{error}</Alert>}

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <ArrowRight className="size-4" />
          )}
          {loading ? "Входим…" : "Войти"}
        </button>

        <p className="text-center text-sm text-muted">
          Нет аккаунта?{" "}
          <Link
            to="/register"
            className="font-semibold text-accent hover:text-accent-hover"
          >
            Создать аккаунт
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
