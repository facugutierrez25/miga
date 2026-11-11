import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export default function SearchMetadata() {
  const { pathname } = useLocation()
  useEffect(() => {
    let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]')
    if (!robots) { robots = document.createElement('meta'); robots.name = 'robots'; document.head.append(robots) }
    robots.content = pathname === '/' ? 'index,follow' : 'noindex'
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (pathname === '/') {
      if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.append(canonical) }
      canonical.href = 'https://miga.uy/'
    } else canonical?.remove()
  }, [pathname])
  return null
}
