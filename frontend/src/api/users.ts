import { apiRequest } from './client'

export async function register(email: string, password: string): Promise<void> {
  return apiRequest(`/api/v1/users`, { method: 'POST', body: { email, password }, errorMessage: 'Error al registrarse. Revisá los datos.', errorMessages: { 409: 'Este email ya está registrado.' } })
}

export async function login(email: string, password: string): Promise<string> {
  const data = await apiRequest<{ token: string }>('/api/v1/users/login', { method: 'POST', body: { email, password }, errorMessage: 'Error al iniciar sesión. Intentá de nuevo.', errorMessages: { 401: 'Email o contraseña incorrectos.', 403: 'EMAIL_NOT_VERIFIED' } })
  return data.token
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
