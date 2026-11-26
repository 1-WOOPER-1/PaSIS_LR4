const API_BASE_URL = import.meta.env.VITE_API_URL as string

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

export async function apiRequest<T = unknown>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, options)
  } catch (error) {
    throw new Error("Сервер недоступен. Проверьте подключение.")
  }

  if (!response.ok) {
    const data = await response.json()
    const detail = data.detail

    const message =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail.map((item) => item.message ?? item.msg).join("; ")
          : `HTTP ${response.status}`
    throw new ApiError(response.status, `Ошибка ${response.status}: ${message}`)
  }
  if (response.status === 204) return undefined as T

  response = await response.json()

  return response as T
}
