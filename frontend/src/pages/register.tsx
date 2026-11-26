import { useState } from "react"
import { useNavigate } from "react-router"
import { apiRequest } from "../lib/api"

export function Register() {
  const [login, setLogin] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")

  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    try {
      await apiRequest("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ login, password }),
      })

      navigate("/login")
    } catch (error: any) {
      setError(error.message)
    }
  }

  return (
    <main className="w-full h-screen flex flex-col justify-center item-center">
      <div className="mx-auto w-xs border p-4 rounded-xl border-border">
        <h1 className="text-2xl font-bold mb-4">Регистрация</h1>
        <form className="flex flex-col gap-4 text-left" onSubmit={handleSubmit}>
          <label htmlFor="login">Логин:</label>
          <input
            className="border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            type="text"
            id="login"
            name="login"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLogin(e.target.value)}
            required
          />

          <label htmlFor="password">Пароль:</label>
          <input
            className="border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            type="password"
            id="password"
            name="password"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
            required
          />

          <button
            className="bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            type="submit"
          >
            Зарегистрироваться
          </button>

          {error && <p className="text-red-500">{error}</p>}
        </form>
      </div>
    </main>
  )
}
