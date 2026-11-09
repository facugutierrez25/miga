import { useEffect, useState } from 'react'

/**
 * Hora actual del dispositivo que se mantiene al día.
 *
 * Se actualiza cada minuto y cada vez que la app vuelve al frente. Hace falta porque,
 * instalada en el inicio del celular, el sistema "congela" la app en segundo plano y
 * al volver la muestra tal como estaba, con la hora de la última vez que se dibujó.
 */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const update = () => setNow(new Date())
    const onBack = () => {
      if (document.visibilityState === 'visible') update()
    }

    const id = window.setInterval(update, intervalMs)
    document.addEventListener('visibilitychange', onBack)
    window.addEventListener('focus', update)
    window.addEventListener('pageshow', update)

    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onBack)
      window.removeEventListener('focus', update)
      window.removeEventListener('pageshow', update)
    }
  }, [intervalMs])

  return now
}
