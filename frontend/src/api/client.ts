const BASE = import.meta.env.VITE_API_URL ?? ''

export class ApiError extends Error {
  readonly status: number
  readonly code?: string
  readonly error?: string
  readonly details: Record<string, unknown>

  constructor(status: number, message: string, details: Record<string, unknown> = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
    this.code = typeof details.code === 'string' ? details.code : undefined
    this.error = typeof details.error === 'string' ? details.error : undefined
  }
}

interface RequestOptions {
  token?: string | null
  signal?: AbortSignal
  method?: string
  body?: unknown
  errorMessage?: string
  errorMessages?: Record<number, string>
  responseType?: 'json' | 'blob' | 'text'
  /** Solo login, refresh y logout envían la cookie del refresh token (ADR 0004). */
  credentials?: RequestCredentials
}

const GET_CACHE_TTL_MS = 30_000
const responseCache = new Map<string, { value: unknown; expiresAt: number }>()
const inFlight = new Map<string, Promise<unknown>>()
let cacheGeneration = 0
let cacheToken: string | null = null

function clearRequestCache() {
  responseCache.clear()
  inFlight.clear()
  cacheGeneration++
}

function withCallerSignal<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise
  if (signal.aborted) return Promise.reject(signal.reason ?? new DOMException('Solicitud cancelada.', 'AbortError'))
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason ?? new DOMException('Solicitud cancelada.', 'AbortError'))
    signal.addEventListener('abort', abort, { once: true })
    promise.then(value => {
      signal.removeEventListener('abort', abort)
      if (!signal.aborted) resolve(value)
    }, error => {
      signal.removeEventListener('abort', abort)
      reject(error)
    })
  })
}

export async function apiRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const token = opts.token ?? null
  if (cacheToken !== token) {
    clearRequestCache()
    cacheToken = token
  }
  if ((opts.method ?? 'GET').toUpperCase() !== 'GET') {
    clearRequestCache()
    try {
      return await performRequest<T>(path, opts)
    } finally {
      clearRequestCache()
    }
  }
  if (opts.signal?.aborted) throw opts.signal.reason ?? new DOMException('Solicitud cancelada.', 'AbortError')
  const key = JSON.stringify([path, token, opts.responseType ?? 'json', opts.credentials,
    opts.body, opts.errorMessage, opts.errorMessages])
  const cached = responseCache.get(key)
  if (cached && cached.expiresAt > Date.now()) return withCallerSignal(Promise.resolve(cached.value as T), opts.signal)
  responseCache.delete(key)
  let pending = inFlight.get(key)
  if (!pending) {
    const generation = cacheGeneration
    pending = performRequest<T>(path, { ...opts, signal: undefined }).then(value => {
      if (generation === cacheGeneration) {
        responseCache.set(key, { value, expiresAt: Date.now() + GET_CACHE_TTL_MS })
      }
      return value
    }).finally(() => {
      if (inFlight.get(key) === pending) inFlight.delete(key)
    })
    inFlight.set(key, pending)
  }
  return withCallerSignal(pending as Promise<T>, opts.signal)
}

async function performRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { token, signal, method = 'GET', body } = opts
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    signal,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    ...(opts.credentials ? { credentials: opts.credentials } : {}),
  })

  if (res.status === 204) return undefined as T
  if (res.ok && opts.responseType === 'blob') {
    const blob = await res.blob()
    return (blob.size ? blob : undefined) as T
  }
  const text = await res.text()
  let data: unknown
  try { data = text.trim() ? JSON.parse(text) : undefined } catch { data = undefined }
  if (!res.ok) {
    const details = data && typeof data === 'object' && !Array.isArray(data)
      ? data as Record<string, unknown> : {}
    const message = opts.errorMessages?.[res.status] ?? opts.errorMessage
      ?? (typeof details.error === 'string' ? details.error : `HTTP ${res.status} ${path}`)
    throw new ApiError(res.status, message, details)
  }
  if (!text.trim()) return undefined as T
  if (opts.responseType === 'text') return text as T
  if (data === undefined) throw new ApiError(res.status, 'La respuesta del servidor no es JSON válido.')
  return data as T
}

export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}

export function isUnauthorized(err: unknown): boolean {
  return err instanceof ApiError && err.status === 401
}

// Un único punto para la sesión vencida: una respuesta 401 a una petición hecha con
// el token de la sesión activa avisa una sola vez, aunque el módulo use fetch directo.
// Un 401 de una petición con un token anterior no afecta a la sesión nueva.
let unauthorizedListener: { token: string; notify: () => void } | null = null
let interceptor: typeof window.fetch | null = null

function bearerToken(input: RequestInfo | URL, init?: RequestInit): string | null {
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
  const value = headers.get('Authorization')
  return value?.startsWith('Bearer ') ? value.slice('Bearer '.length) : null
}

// Se reinstala si otro código reemplazó window.fetch después de instalarlo.
function installUnauthorizedInterceptor() {
  if (interceptor && window.fetch === interceptor) return
  const originalFetch = window.fetch.bind(window)
  interceptor = async (input: RequestInfo | URL, init?: RequestInit) => {
    const res = await originalFetch(input, init)
    if (res.status === 401 && unauthorizedListener && bearerToken(input, init) === unauthorizedListener.token) {
      const { notify } = unauthorizedListener
      unauthorizedListener = null
      clearRequestCache()
      notify()
    }
    return res
  }
  window.fetch = interceptor
}

export function onUnauthorizedResponse(token: string, handler: () => void): () => void {
  clearRequestCache()
  installUnauthorizedInterceptor()
  const listener = { token, notify: handler }
  unauthorizedListener = listener
  return () => {
    if (unauthorizedListener === listener) {
      unauthorizedListener = null
      clearRequestCache()
    }
  }
}
