import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

function isVisible(element: HTMLElement): boolean {
  for (let current: HTMLElement | null = element; current; current = current.parentElement) {
    const style = window.getComputedStyle(current)
    if (current.hidden || style.display === 'none' || style.visibility === 'hidden') return false
  }
  return true
}

export default function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
    const target = Array.from(document.querySelectorAll<HTMLElement>('h1')).find(isVisible)
      ?? document.querySelector<HTMLElement>('main')
    if (target) {
      target.tabIndex = -1
      target.focus({ preventScroll: true })
    }
  }, [pathname])
  return null
}
