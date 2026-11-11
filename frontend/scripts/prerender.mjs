import { build } from 'vite'
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises'
import { resolve, join, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

// El HTML usa el mismo componente que el cliente; el bundle temporal no se publica.
const temporary = await mkdtemp(resolve('node_modules/.prerender-'))
if (!temporary.startsWith(resolve('node_modules') + sep)) throw new Error('Directorio temporal fuera de node_modules')
try {
  await build({ build: { ssr: 'src/entry-prerender.tsx', outDir: temporary, emptyOutDir: true } })
  const { render } = await import(pathToFileURL(join(temporary, 'entry-prerender.js')).href)
  const template = await readFile('dist/index.html', 'utf8')
  const app = template.replace(/<link rel="canonical"[^>]*>/g, '').replace(/<meta name="description"[^>]*>/g, '').replace('</head>', '<meta name="robots" content="noindex" /></head>')
  await writeFile('dist/app.html', app)
  const content = render()
  if (!content.includes('Anotá lo que comiste.')) throw new Error('No se generó el contenido de la portada')
  await writeFile('dist/index.html', template.replace('<div id="root"></div>', `<div id="root">${content}</div>`))
} finally {
  await rm(temporary, { recursive: true, force: true })
}
