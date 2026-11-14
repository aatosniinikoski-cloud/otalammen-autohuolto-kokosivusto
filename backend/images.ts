import { createRemoteJWKSet, jwtVerify } from 'jose'

export interface Bucket {
  put(key: string, body: ReadableStream | ArrayBuffer, options: any): Promise<unknown>
  get(key: string): Promise<{ body: ReadableStream; customMetadata?: Record<string,string>; httpMetadata?: {contentType?:string} } | null>
  delete(key: string): Promise<void>
  list(options: any): Promise<{objects:Array<{key:string;uploaded:Date}>;truncated:boolean;cursor?:string}>
}
export interface ImageEnv {
  IMAGES: Bucket
  ATTACHMENT_BASE_URL: string
  ACCESS_TEAM_DOMAIN: string
  ACCESS_AUD: string
  ACCESS_ALLOWED_EMAIL: string
}
export const retention = 90 * 86400000
const jwks = new Map<string, ReturnType<typeof createRemoteJWKSet>>()
export async function imageRoute(request: Request, env: ImageEnv): Promise<Response> {
  const h = { 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'no-referrer' }
  try {
    if (!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(env.ACCESS_TEAM_DOMAIN) || !env.ACCESS_AUD || !env.ACCESS_ALLOWED_EMAIL) return new Response('Not configured', {status:503,headers:h})
    const issuer = `https://${env.ACCESS_TEAM_DOMAIN}`
    if (!jwks.has(issuer)) jwks.set(issuer, createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`)))
    const token = request.headers.get('Cf-Access-Jwt-Assertion') || ''
    const {payload} = await jwtVerify(token, jwks.get(issuer)!, {issuer, audience:env.ACCESS_AUD, algorithms:['RS256'], requiredClaims:['exp','iat','email']})
    if (typeof payload.email !== 'string' || payload.email.toLowerCase() !== env.ACCESS_ALLOWED_EMAIL.toLowerCase()) return new Response('Forbidden', {status:403,headers:h})
  } catch { return new Response('Authentication required', {status:401,headers:h}) }
  const key = new URL(request.url).pathname.slice(1)
  if (!/^attachments\/[0-9a-f-]{36}\/[0-4]$/.test(key)) return new Response('Not found', {status:404,headers:h})
  if (request.method === 'DELETE') { await env.IMAGES.delete(key); return new Response(null, {status:204,headers:h}) }
  if (request.method !== 'GET') return new Response('Method not allowed', {status:405,headers:h})
  const image = await env.IMAGES.get(key)
  if (!image || !Number.isFinite(Number(image.customMetadata?.expires)) || Number(image.customMetadata?.expires) < Date.now()) return new Response('Not found', {status:404,headers:h})
  return new Response(image.body, {headers:{...h,'Content-Type':image.httpMetadata?.contentType || 'application/octet-stream','Content-Disposition':'inline'}})
}
export async function validateImages(files: File[], metadata: any[]) {
  if (!Array.isArray(metadata) || files.length !== metadata.length || files.length > 5) throw new Error('images')
  const hashes = []
  for (let i=0;i<files.length;i++) {
    const file=files[i], meta=metadata[i]
    if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size < 12 || file.size > 10*1024*1024 || meta.type !== file.type || meta.size !== file.size || meta.name !== file.name || file.name.length > 255) throw new Error('images')
    const bytes = new Uint8Array(await file.arrayBuffer())
    const jpeg=bytes[0]===255 && bytes[1]===216 && bytes[2]===255
    const png=[137,80,78,71,13,10,26,10].every((v,j)=>bytes[j]===v)
    const webp=new TextDecoder().decode(bytes.slice(0,4))==='RIFF' && new TextDecoder().decode(bytes.slice(8,12))==='WEBP'
    if (!(file.type==='image/jpeg'?jpeg:file.type==='image/png'?png:webp)) throw new Error('images')
    hashes.push([...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join(''))
  }
  return hashes
}
export async function deleteExpired(env: ImageEnv) {
  let cursor: string | undefined
  do {
    const page=await env.IMAGES.list({prefix:'attachments/',cursor,limit:1000})
    for (const item of page.objects) if (Date.now()-new Date(item.uploaded).getTime()>=retention) await env.IMAGES.delete(item.key)
    cursor=page.truncated?page.cursor:undefined
  } while (cursor)
}
