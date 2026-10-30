const BASE = import.meta.env.VITE_API_URL ?? ''

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

interface RequestOptions {
  token?: string | null
  signal?: AbortSignal
  method?: string
  body?: unknown
}

export async function apiRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { token, signal, method = 'GET', body } = opts
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    signal,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) throw new ApiError(res.status, `HTTP ${res.status} ${path}`)
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}

export function isUnauthorized(err: unknown): boolean {
  return err instanceof ApiError && err.status === 401
}
