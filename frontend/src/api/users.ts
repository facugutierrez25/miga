const API_URL = import.meta.env.VITE_API_URL ?? ''

export async function register(email: string, password: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/v1/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (response.status === 409) throw new Error('Este email ya está registrado.')
  if (!response.ok) throw new Error('Error al registrarse. Revisá los datos.')
}

export async function login(email: string, password: string): Promise<string> {
  const response = await fetch(`${API_URL}/api/v1/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (response.status === 401) throw new Error('Email o contraseña incorrectos.')
  if (response.status === 403) throw new Error('EMAIL_NOT_VERIFIED')
  if (!response.ok) throw new Error('Error al iniciar sesión. Intentá de nuevo.')
  const data = await response.json()
  return data.token
}

export async function verifyEmail(token: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/v1/auth/verify?token=${encodeURIComponent(token)}`)
  if (!response.ok) throw new Error('INVALID_TOKEN')
}

export async function resendVerification(email: string): Promise<void> {
  await fetch(`${API_URL}/api/v1/auth/resend-verification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
}

export interface UserProfile {
  email: string
  firstName: string | null
  lastName: string | null
  birthDate: string | null
}

export async function getMe(token: string): Promise<UserProfile> {
  const response = await fetch(`${API_URL}/api/v1/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) throw new Error('Error al obtener perfil.')
  return response.json()
}

export async function updateMe(
  token: string,
  data: { firstName: string; lastName?: string; birthDate?: string }
): Promise<UserProfile> {
  const response = await fetch(`${API_URL}/api/v1/users/me`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  })
  if (!response.ok) throw new Error('Error al guardar perfil.')
  return response.json()
}
