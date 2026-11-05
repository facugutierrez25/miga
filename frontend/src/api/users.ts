import { apiRequest } from './client'

export async function register(email: string, password: string): Promise<void> {
  return apiRequest(`/api/v1/users`, { method: 'POST', body: { email, password }, errorMessage: 'Error al registrarse. Revisá los datos.', errorMessages: { 409: 'Este email ya está registrado.' } })
}

export async function login(email: string, password: string): Promise<string> {
  const data = await apiRequest<{ token: string }>('/api/v1/users/login', { method: 'POST', body: { email, password }, credentials: 'include', errorMessage: 'Error al iniciar sesión. Intentá de nuevo.', errorMessages: { 401: 'Email o contraseña incorrectos.', 403: 'EMAIL_NOT_VERIFIED' } })
  return data.token
}

// Restaura la sesión con el refresh token de la cookie HttpOnly. Devuelve null si no hay sesión.
export async function refreshSession(): Promise<string | null> {
  try {
    const data = await apiRequest<{ token?: unknown }>('/api/v1/auth/refresh', { method: 'POST', credentials: 'include' })
    return data && typeof data.token === 'string' ? data.token : null
  } catch {
    return null
  }
}

// Revoca el refresh token del dispositivo. Si falla, la cookie vence sola.
export async function logoutSession(): Promise<void> {
  try {
    await apiRequest('/api/v1/auth/logout', { method: 'POST', credentials: 'include' })
  } catch {
    // Sin conexión: la sesión en memoria ya se cerró igual.
  }
}

export async function verifyEmail(token: string): Promise<void> {
  return apiRequest(`/api/v1/auth/verify?token=${encodeURIComponent(token)}`, { errorMessage: 'INVALID_TOKEN' })
}

export async function resendVerification(email: string): Promise<void> {
  await apiRequest('/api/v1/auth/resend-verification', { method: 'POST', body: { email } })
}

export interface UserProfile {
  email: string
  firstName: string | null
  lastName: string | null
  birthDate: string | null
}

export async function getMe(token: string): Promise<UserProfile> {
  return apiRequest(`/api/v1/users/me`, { errorMessage: 'Error al obtener perfil.', token })
}

export async function updateMe(
  token: string,
  data: { firstName: string; lastName?: string; birthDate?: string }
): Promise<UserProfile> {
  return apiRequest(`/api/v1/users/me`, { errorMessage: 'Error al guardar perfil.', token, method: 'PATCH', body: data })
}

export async function deleteMe(token: string, password: string): Promise<void> {
  return apiRequest('/api/v1/users/me', {
    token, method: 'DELETE', body: { password },
    errorMessage: 'No se pudo eliminar tu cuenta. Intentá de nuevo.',
    errorMessages: {
      403: 'Contraseña incorrecta. No se eliminó tu cuenta.',
      429: 'Demasiados intentos. Intentá de nuevo más tarde.',
    },
  })
}
