import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiRequest, ApiError } from './client'
import { login, register } from './users'
import { saveNota, NoteConflictError } from './registro'
import { saveMyPlan, PlanConflictError } from './plans'
import { deleteGroup, PlanRulesError } from './planRules'
import { exportWeekCsv } from './semana'

function respond(body: string | null, status = 200) {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(body, { status })))
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('cliente HTTP', () => {
  it('conserva status, code y error del backend', async () => {
    respond(JSON.stringify({ code: 'VERSION_CONFLICT', error: 'El plan cambió.' }), 409)
    await expect(apiRequest('/test')).rejects.toMatchObject({ status: 409, code: 'VERSION_CONFLICT', error: 'El plan cambió.' })
  })
  it('conserva los errores de validación', async () => {
    const errors = [{ code: 'VALIDATION', error: 'Revisá el email.' }]
    respond(JSON.stringify({ errors }), 400)
    await expect(apiRequest('/test')).rejects.toMatchObject({ details: { errors } })
  })
  it.each([200, 204])('devuelve undefined para una respuesta vacía %s', async status => {
    respond(null, status)
    await expect(apiRequest('/test')).resolves.toBeUndefined()
  })
  it.each([null, '<html>Error</html>'])('convierte errores vacíos o no JSON en ApiError', async body => {
    respond(body, 500)
    await expect(apiRequest('/test')).rejects.toBeInstanceOf(ApiError)
    await expect(apiRequest('/test')).rejects.toMatchObject({ status: 500 })
  })
  it('rechaza una respuesta exitosa con JSON inválido de forma controlada', async () => {
    respond('no es JSON')
    await expect(apiRequest('/test')).rejects.toBeInstanceOf(ApiError)
  })
  it('devuelve undefined para un blob vacío', async () => {
    respond(null)
    await expect(apiRequest('/test', { responseType: 'blob' })).resolves.toBeUndefined()
  })
  it('admite texto y envía token, cuerpo y señal', async () => {
    respond('a,b\n1,2')
    const signal = new AbortController().signal
    await expect(apiRequest('/test', { token: 'token', method: 'POST', body: { value: 1 }, signal, responseType: 'text' })).resolves.toBe('a,b\n1,2')
    expect(fetch).toHaveBeenCalledWith('/test', expect.objectContaining({ signal, body: '{"value":1}', headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' } }))
  })
})

it.each([
  [401, 'Email o contraseña incorrectos.'], [403, 'EMAIL_NOT_VERIFIED'],
])('mantiene el mensaje de login %s', async (status, message) => {
  respond(null, status)
  await expect(login('a@b.uy', 'password')).rejects.toThrow(message)
})
it('devuelve el token del login y conserva el mensaje de registro duplicado', async () => {
  respond('{"token":"token"}')
  await expect(login('a@b.uy', 'password')).resolves.toBe('token')
  respond(null, 409)
  await expect(register('a@b.uy', 'password')).rejects.toThrow('Este email ya está registrado.')
})
it('conserva los conflictos de notas y del plan', async () => {
  respond('{"code":"NOTE_CONFLICT","error":"La nota cambió."}', 409)
  await expect(saveNota('token', '2026-01-01', 1, 'pan', 1)).rejects.toBeInstanceOf(NoteConflictError)
  respond('{"code":"VERSION_CONFLICT"}', 409)
  await expect(saveMyPlan('token', { meals: [] })).rejects.toBeInstanceOf(PlanConflictError)
})
it.each(['VERSION_CONFLICT', 'GROUP_IN_USE', 'DUPLICATE'])('conserva el conflicto de reglas %s y sus cantidades', async code => {
  respond(JSON.stringify({ code, error: 'Revisá el grupo.', comidas: 2, alimentos: 3 }), 409)
  await expect(deleteGroup('token', 'uid', 1)).rejects.toBeInstanceOf(PlanRulesError)
  await expect(deleteGroup('token', 'uid', 1)).rejects.toMatchObject({ status: 409, code, error: 'Revisá el grupo.', comidas: 2, alimentos: 3 })
})
it('exporta el CSV como blob sin intentar leer JSON', async () => {
  respond('fecha,total\n2026-01-01,2')
  const createObjectURL = vi.fn().mockReturnValue('blob:csv')
  const revokeObjectURL = vi.fn()
  vi.stubGlobal('URL', Object.assign(class extends URL {}, { createObjectURL, revokeObjectURL }))
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  await exportWeekCsv('token', '2026-01-01')
  expect(createObjectURL).toHaveBeenCalledOnce()
  await expect(createObjectURL.mock.calls[0][0].text()).resolves.toBe('fecha,total\n2026-01-01,2')
  expect(click).toHaveBeenCalledOnce()
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:csv')
})
