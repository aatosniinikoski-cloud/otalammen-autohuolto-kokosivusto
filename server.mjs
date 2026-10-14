import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('.', import.meta.url))
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
}

createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname)
    const safePath = normalize(pathname).replace(/^(\.\.[/\\])+/, '')
    let filePath = join(root, safePath === '/' ? 'index.html' : safePath)
    if (!(await stat(filePath)).isFile()) filePath = join(root, 'index.html')
    const body = await readFile(filePath)
    response.writeHead(200, { 'Content-Type': mime[extname(filePath)] || 'application/octet-stream', 'Cache-Control': 'no-store' })
    response.end(body)
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('Sivua ei löytynyt')
  }
}).listen(4174, '127.0.0.1', () => {
  console.log('Autohuolto Aulis demo: http://127.0.0.1:4174')
})
