import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiRequest, ApiError, onUnauthorizedResponse } from './client'
import { login, register, logoutSession } from './users'
import { saveNote, NoteConflictError, getUnmatchedFoods } from './records'
import { saveMyPlan, PlanConflictError } from './plans'
import { deleteGroup, PlanRulesError } from './planRules'
import { exportWeekCsv, exportRange } from './week'

function respond(body: string | null, status = 200) {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(body, { status })))
}
afterEach(() => { onUnauthorizedResponse('cleanup', () => {})(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

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
  await expect(saveNote('token', '2026-01-01', 1, 'pan', 1)).rejects.toBeInstanceOf(NoteConflictError)
  respond('{"code":"PLAN_CHANGED","error":"Tu plan cambió."}', 409)
  await expect(saveNote('token', '2026-01-01', 1, 'pan', 1)).rejects.toThrow('Tu plan cambió.')
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
it('exporta un rango con formato y secciones elegidas', async () => {
  const fetchMock = vi.fn().mockImplementation(async () => new Response('%PDF-', { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('URL', Object.assign(class extends URL {}, { createObjectURL: vi.fn().mockReturnValue('blob:pdf'), revokeObjectURL: vi.fn() }))
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  await exportRange('token', '2026-11-02', '2026-11-15', 'pdf', ['texto', 'sinregla'])
  expect(String(fetchMock.mock.calls[0][0])).toContain('/api/v1/semana/export?from=2026-11-02&to=2026-11-15&format=pdf&incluir=texto%2Csinregla')
  expect(click).toHaveBeenCalledOnce()
})
it('pide lo que no se reconoció en un rango', async () => {
  const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify([{ texto: 'torta frita', fecha: '2026-11-02', comida: 'Merienda' }]), { status: 200, headers: { 'Content-Type': 'application/json' } }))
  vi.stubGlobal('fetch', fetchMock)
  await expect(getUnmatchedFoods('token', '2026-11-02', '2026-11-08')).resolves.toEqual([{ texto: 'torta frita', fecha: '2026-11-02', comida: 'Merienda' }])
  expect(String(fetchMock.mock.calls[0][0])).toContain('/api/v1/registro/sin-regla?desde=2026-11-02&hasta=2026-11-08')
})

describe('caché de GET', () => {
  it('comparte GET simultáneos y vence a los 30 segundos', async () => {
    vi.useFakeTimers()
    respond('{"value":1}')
    const values = await Promise.all([apiRequest('/cache'), apiRequest('/cache')])
    expect(values).toEqual([{ value: 1 }, { value: 1 }])
    await apiRequest('/cache')
    expect(fetch).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(30_001)
    await apiRequest('/cache')
    expect(fetch).toHaveBeenCalledTimes(2)
  })
  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('invalida con %s', async method => {
    respond('{}')
    await apiRequest('/cache')
    await apiRequest('/mutation', { method })
    await apiRequest('/cache')
    expect(fetch).toHaveBeenCalledTimes(3)
  })
  it('cancelar un consumidor no afecta al otro ni a la caché', async () => {
    let finish!: (response: Response) => void
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { finish = resolve })))
    const controller = new AbortController()
    const first = apiRequest('/cache', { signal: controller.signal })
    const second = apiRequest('/cache')
    const rejected = expect(first).rejects.toMatchObject({ name: 'AbortError' })
    controller.abort()
    await rejected
    finish(new Response('{"value":1}'))
    await expect(second).resolves.toEqual({ value: 1 })
    await expect(apiRequest('/cache')).resolves.toEqual({ value: 1 })
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  it('no guarda errores', async () => {
    respond('{}', 500)
    await expect(apiRequest('/cache')).rejects.toBeInstanceOf(ApiError)
    await expect(apiRequest('/cache')).rejects.toBeInstanceOf(ApiError)
    expect(fetch).toHaveBeenCalledTimes(2)
  })
  it('logout y cambio de token vacían la caché', async () => {
    respond('{}')
    await apiRequest('/cache', { token: 'first' })
    await apiRequest('/cache', { token: 'second' })
    await apiRequest('/cache', { token: 'first' })
    expect(fetch).toHaveBeenCalledTimes(3)
    await logoutSession()
    await apiRequest('/cache', { token: 'first' })
    expect(fetch).toHaveBeenCalledTimes(5)
  })
  it('una respuesta anterior a una mutación no repuebla la caché', async () => {
    let finish!: (response: Response) => void
    vi.stubGlobal('fetch', vi.fn()
      .mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve }))
      .mockImplementation(async () => new Response('{}')))
    const pending = apiRequest('/cache')
    await apiRequest('/mutation', { method: 'POST' })
    finish(new Response('{}'))
    await pending
    await apiRequest('/cache')
    expect(fetch).toHaveBeenCalledTimes(3)
  })
})
