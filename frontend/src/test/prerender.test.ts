// @vitest-environment node
import { expect, test } from 'vitest'
import { render } from '../entry-prerender'
import { readFileSync } from 'node:fs'

test('la portada entrega contenido real sin navegador ni datos personales', () => {
  const html = render()
  expect(html.match(/<h1[ >]/g)).toHaveLength(1)
  expect(html).toContain('Anotá lo que comiste.')
  expect(html).toContain('Pizza con amigos')
  expect(html).toContain('Tus hábitos también se anotan.')
  expect(html).toContain('href="/register"')
  expect(html).not.toContain('Hoy autenticado')
  expect(html).not.toContain('style=')
})
test('el sitemap solo publica la portada y robots permite descubrirla', () => {
  const sitemap = readFileSync('public/sitemap.xml', 'utf8')
  expect(sitemap.match(/<loc>/g)).toHaveLength(1)
  expect(sitemap).toContain('<loc>https://miga.uy/</loc>')
  expect(readFileSync('public/robots.txt', 'utf8')).toContain('Sitemap: https://miga.uy/sitemap.xml')
})
