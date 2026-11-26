import { useNavigate } from "react-router"

function App() {
  const navigate = useNavigate()
  const token = localStorage.getItem("token")

  if (!token) {
    navigate("/login")
  }

  return (
    <main className="w-full h-screen flex flex-col items-center justify-center">
      <span className="text-lg ">Проверка...</span>
    </main>
  )
}

export default App
