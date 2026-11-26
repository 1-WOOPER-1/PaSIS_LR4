import { useState, useEffect } from "react"
import { useNavigate } from "react-router"
import { ApiError, apiRequest } from "../lib/api"

interface User {
  id: number
  login: string
  roles: string[]
  permissions: string[]
}

interface UserItem {
  id: number
  login: "string"
}

export function Main() {
  const [user, setUser] = useState<User | null>(null)
  const [users, setUsers] = useState<UserItem[]>([])
  const [error, setError] = useState("")

  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"))

  const navigate = useNavigate()

  async function getUsersList() {
    try {
      const data = await apiRequest<UserItem[]>("/api/users", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      setUsers(data)
    } catch (e) {
      const error = e as ApiError
      setError(error.message)
    }
  }

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
      <div className="mx-auto w-md border p-4 rounded-xl border-border">
        {user && (
          <div className="text-left">
            <p className="text-lg mb-4 text-center text-white">
              Добро пожаловать, {user.login}!
            </p>
            <table>
              <tr>
                <td className="w-40">ID пользователя:</td>
                <td>{user.id}</td>
              </tr>
              <tr>
                <td>Роли:</td>
                <td>{user.roles.join(", ")}</td>
              </tr>
              <tr>
                <td>Разрешения:</td>
                <td>{user.permissions.join(", ")}</td>
              </tr>
            </table>
          </div>
        )}
        <h2 className="mt-4 text-left">Список пользователей</h2>
        <table className="my-4">
          {users.length > 0 &&
            users.map((u) => (
              <tr>
                <td>{u.id}</td>
                <td>{u.login}</td>
              </tr>
            ))}
        </table>
        <button
          className="bg-blue-500 text-white text-sm py-2 px-4 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          onClick={getUsersList}
        >
          Загрузить
        </button>

        {error && <p className="text-red-500">{error}</p>}
      </div>
    </main>
  )
}
