import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react'
import { isAbortError } from '../api/client'

export type LoadStatus = 'loading' | 'success' | 'empty' | 'error'
interface ResourceState<T> {
  key: string
  attempt: number
  status: LoadStatus
  data: T | null
  error: unknown
}

export function useResource<T>(key: string, enabled: boolean,
  load: (signal: AbortSignal) => Promise<T>, isEmpty: (data: T) => boolean) {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<ResourceState<T> | null>(null)
  const active = useRef<{ key: string; attempt: number; controller: AbortController; sequence: number } | null>(null)
  // La clave cambia durante el render para que no se conserve la sesión anterior.
  if (state && state.key !== key) setState(null)
  const current = state?.key === key && state.attempt === attempt ? state : null

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    const session = { key, attempt, controller, sequence: 0 }
    active.current = session
    load(controller.signal).then(data => {
      if (!controller.signal.aborted && session.sequence === 0) {
        setState({ key, attempt, data, status: !data || isEmpty(data) ? 'empty' : 'success', error: null })
      }
    }).catch((error: unknown) => {
      if (!controller.signal.aborted && session.sequence === 0 && !isAbortError(error)) {
        setState({ key, attempt, data: null, status: 'error', error })
      }
    })
    return () => controller.abort()
  }, [key, enabled, attempt, load, isEmpty])

  const reload = useCallback(async () => {
    const session = active.current
    if (!session || session.key !== key || session.attempt !== attempt || session.controller.signal.aborted) {
      throw new DOMException('La carga fue cancelada.', 'AbortError')
    }
    const sequence = ++session.sequence
    try {
      const data = await load(session.controller.signal)
      if (session.controller.signal.aborted || session.sequence !== sequence) {
        throw new DOMException('La carga fue cancelada.', 'AbortError')
      }
      setState({ key, attempt, data, status: !data || isEmpty(data) ? 'empty' : 'success', error: null })
      return data
    } catch (error) {
      if (!session.controller.signal.aborted && session.sequence === sequence && !isAbortError(error)) {
        setState({ key, attempt, data: null, status: 'error', error })
      }
      throw error
    }
  }, [key, attempt, load, isEmpty])
  const retry = useCallback(() => setAttempt(value => value + 1), [])
  // Cada callback conserva su clave: una mutación vieja no modifica la vista nueva.
  const setData = useCallback((update: SetStateAction<T | null>) => {
    setState(previous => {
      if (!previous || previous.key !== key || previous.attempt !== attempt) return previous
      const data = typeof update === 'function'
        ? (update as (value: T | null) => T | null)(previous.data) : update
      return { ...previous, data, status: !data || isEmpty(data) ? 'empty' : 'success' }
    })
  }, [key, attempt, isEmpty])
  return {
    data: enabled ? current?.data ?? null : null,
    status: enabled ? current?.status ?? 'loading' : 'empty' as LoadStatus,
    error: current?.error ?? null, retry, reload, setData,
  }
}
