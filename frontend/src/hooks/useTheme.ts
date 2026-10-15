import { useState } from 'react'

export type Theme = 'auto' | 'light' | 'dark'

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(
    () => (localStorage.getItem('theme') as Theme | null) ?? 'auto'
  )

  function setTheme(t: Theme) {
    const root = document.documentElement
    if (t === 'auto') {
      root.removeAttribute('data-theme')
      localStorage.removeItem('theme')
    } else {
      root.setAttribute('data-theme', t)
      localStorage.setItem('theme', t)
    }
    setThemeState(t)
  }

  return { theme, setTheme }
}
