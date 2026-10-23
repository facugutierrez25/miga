import { useEffect, useState } from 'react'

/**
 * Hora actual del dispositivo que se mantiene al día.
 *
 * Se actualiza cada minuto y cada vez que la app vuelve al frente. Hace falta porque,
 * instalada en el inicio del celular, el sistema "congela" la app en segundo plano y
 * al volver la muestra tal como estaba, con la hora de la última vez que se dibujó.
 */
export function useAhora(intervaloMs = 60_000): Date {
  const [ahora, setAhora] = useState(() => new Date())

  useEffect(() => {
    const actualizar = () => setAhora(new Date())
    const alVolver = () => {
      if (document.visibilityState === 'visible') actualizar()
    }

    const id = window.setInterval(actualizar, intervaloMs)
    document.addEventListener('visibilitychange', alVolver)
    window.addEventListener('focus', actualizar)
    window.addEventListener('pageshow', actualizar)

    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', alVolver)
      window.removeEventListener('focus', actualizar)
      window.removeEventListener('pageshow', actualizar)
    }
  }, [intervaloMs])

  return ahora
}
