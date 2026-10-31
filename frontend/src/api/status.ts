import { apiRequest } from './client'
export interface Status {
  app: string
  version: string
  database: string
  serverTime: string
}

// En producción, VITE_API_URL apunta al backend desplegado (ej. https://api.midominio.uy).
// En desarrollo queda vacío y el proxy de Vite redirige /api al backend local.

export async function fetchStatus(): Promise<Status> {
  return apiRequest(`/api/v1/status`)
}
