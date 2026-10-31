import { describe, expect, it } from 'vitest'
import html from '../../index.html?raw'
import vercel from '../../vercel.json'

// La CSP de vercel.json permite el script en línea de index.html solo por su hash:
// si se cambia el script sin actualizar el hash, la app deja de aplicar el tema guardado.
const headers: { key: string; value: string }[] = vercel.headers[0].headers
const csp = headers.find(h => h.key === 'Content-Security-Policy')!.value

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
}

describe('cabeceras de seguridad', () => {
  it('la CSP incluye el hash de cada script en línea de index.html', async () => {
    const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1])
    expect(inline.length).toBeGreaterThan(0)
    for (const script of inline) {
      expect(csp).toContain(`'sha256-${await sha256(script.replace(/\r\n/g, '\n'))}'`)
    }
  })

  it('impide que otra web embeba la app y limita los permisos', () => {
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("object-src 'none'")
    expect(headers.find(h => h.key === 'X-Frame-Options')?.value).toBe('DENY')
    expect(headers.find(h => h.key === 'Permissions-Policy')?.value).toContain('microphone=(self)')
  })
})
