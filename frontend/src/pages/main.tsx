import { useState, useEffect } from "react"
import { useNavigate } from "react-router"
import { ApiError, apiRequest } from "../lib/api"

interface User {
  id: number
  login: string
  roles: string[]
  permissions: string[]
}

export function Main() {
  const [user, setUser] = useState<User | null>(null)
  const [error, setError] = useState("")

  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"))

  const navigate = useNavigate()

  useEffect(() => {
    if (!token) {
      navigate("/login")
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
        const err = e as ApiError
        setError(err.message)

        if (err.status == 401) {
          setToken(null)
          localStorage.removeItem("token")
          navigate("/login")
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [token, navigate])

  return (
    <main className="w-full h-screen flex flex-col justify-center item-center">
      <div className="mx-auto w-xs border p-4 rounded-xl border-border">
        <h1 className="text-2xl font-bold mb-8">Главная страница</h1>
        {user && (
          <div className="text-left">
            <p className="text-lg mb-4 text-center">Добро пожаловать, {user.login}!</p>
            <p className="text-sm">ID пользователя: {user.id}</p>
            <p className="text-sm">Роли: {user.roles.join(", ")}</p>
            <p className="text-sm">Разрешения: {user.permissions.join(", ")}</p>
          </div>
        )}
        {error && <p className="text-red-500">{error}</p>}
      </div>
    </main>
  )
}
