import { useState, useEffect } from "react"
import { useNavigate } from "react-router"
import { ApiError, apiRequest } from "../lib/api"

const ROLES = ["user", "moderator", "admin"]

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
  const [selectedUser, setSelectedUser] = useState<number | null>(null)
  const [selectedRole, setSelectedRole] = useState<string | null>(null)

  const [info, setInfo] = useState("")
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

  async function handleChangeRole() {
    try {
      await apiRequest(`/api/users/${selectedUser}/roles/${selectedRole}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          target_user_id: Number(selectedUser),
          role_name: selectedRole,
        }),
      })
      setInfo(
        `Пользователь ${users.find((u) => u.id === selectedUser)?.login} теперь ${selectedRole}`,
      )
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
              <tbody>
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
              </tbody>
            </table>
          </div>
        )}

        <h2 className="mt-4 text-left">Список пользователей</h2>
        {users.length > 0 && (
          <table>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <td>{u.login}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <button
          className="bg-blue-500 text-white text-sm py-2 px-4 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          onClick={getUsersList}
        >
          Загрузить
        </button>

        {users.length > 0 && (
          <>
            <h2 className="mt-4">Изменить роль:</h2>
            <div className="flex gap-3 mt-2">
              <select
                className="border-2 border-border rounded-lg py-1 px-2"
                defaultValue="id"
                onChange={(e) => {
                  setSelectedUser(Number(e.target.value))
                }}
              >
                <option value="id" disabled>
                  login
                </option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.id} {u.login}
                  </option>
                ))}
              </select>

              <select
                className="border-2 border-border rounded-lg py-1 px-2"
                defaultValue="role"
                onChange={(e) => {
                  setSelectedRole(e.target.value)
                }}
              >
                <option value="role" disabled>
                  role
                </option>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>

              <button
                className="bg-blue-500 text-white text-sm py-2 px-4 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                onClick={handleChangeRole}
              >
                Изменить
              </button>
            </div>
          </>
        )}

        {info && <p className="text-emerald-500">{info}</p>}
        {error && <p className="text-red-500">{error}</p>}
      </div>
    </main>
  )
}
