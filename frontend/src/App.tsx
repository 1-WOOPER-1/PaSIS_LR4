import { Navigate } from "react-router"

function App() {
  const token = localStorage.getItem("token")

  return <Navigate to={token ? "/" : "/login"} replace />
}

export default App
