import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const base = '/otalammen-autohuolto-kokosivusto/'
const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8')
const localURLs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
  .map(match => match[1]).filter(url => !/^(?:https?:|data:|#|mailto:|tel:)/.test(url))
for (const url of localURLs) {
  const pathname = new URL(url, `https://example.test${base}`).pathname
  assert.ok(pathname.startsWith(base), `Asset must respect the Pages base: ${url}`)
  assert.ok(existsSync(resolve('dist', pathname.slice(base.length))), `Missing built asset: ${url}`)
}
assert.ok(!html.includes('/src/calculator/main.tsx'), 'Pages must never serve raw TSX')
assert.match(html, /type="module"[^>]+src="\/otalammen-autohuolto-kokosivusto\/assets\/[^" ]+\.js"/)
assert.ok(html.includes('href="tel:0440950100"'))
assert.ok(html.includes('id="estimate-root"'))
assert.ok(html.includes('vastaanottopalvelua ei ole vielä liitetty'))
console.log(`Production build checked: ${localURLs.length} local asset references, compiled calculator and phone CTA.`)
