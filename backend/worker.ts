import { calculatePrice, formatPrice, serviceCatalog } from '../src/data/serviceCatalog'
import { validateStep } from '../src/lib/estimateRequest'
import type { EstimateData } from '../src/types/estimate'
import { imageRoute, validateImages, deleteExpired, retention } from './images'
import type { ImageEnv } from './images'

interface Statement {
  bind(...values: unknown[]): Statement
  first<T = Record<string, unknown>>(): Promise<T | null>
  run(): Promise<{ meta: { changes: number } }>
}
export interface Env extends ImageEnv {
  DB: { prepare(sql: string): Statement }
  GHL_WEBHOOK_URL: string
  RATE_LIMIT_SALT: string
  ALLOWED_ORIGINS: string
  ESTIMATE_PUBLIC_ENABLED?: string
}
const statuses = ['Kiinteä hinta', 'Suuntaa-antava arvio', 'Vaatii hinnoittelun']
class Invalid extends Error {}
class TooLarge extends Error {}
class UpstreamFailure extends Error {
  constructor(readonly diagnostic: Record<string, unknown>) { super('upstream') }
}
// Never log response text, arbitrary values, URLs, headers, or exception messages.
export async function safeResponseSummary(response: Response) {
  const summary: Record<string, unknown> = {httpStatus:response.status,format:'unread',signal:'unclassified'}
  const reader = response.body?.getReader()
  if (!reader) return {...summary,format:'empty'}
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const read = async () => {
      const chunks: Uint8Array[] = []; let size = 0
      while (size < 4096) {
        const chunk = await reader.read(); if (chunk.done) break
        const part = chunk.value.subarray(0,4096-size); chunks.push(part); size += part.length
      }
      const bytes = new Uint8Array(size); let offset=0
      for (const chunk of chunks) {bytes.set(chunk,offset);offset+=chunk.length}
      return new TextDecoder().decode(bytes)
    }
    const raw = await Promise.race([read(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('deadline')),1000)})])
    summary.inspectedBytes = new TextEncoder().encode(raw).length
    summary.format = raw.trim() ? 'text' : 'empty'
    try {
      const value = JSON.parse(raw)
      summary.format = 'json'
      summary.fields = ['error','message','statusCode','status','code','success'].filter(key=>value && typeof value==='object' && Object.hasOwn(value,key))
      if (typeof value?.success==='boolean') summary.successFlag=value.success
      summary.hasReceiptId=typeof value?.id==='string' && value.id.length>0
    } catch { if (/^\s*<!doctype html|^\s*<html/i.test(raw)) summary.format='html' }
    // Categories only: even a response echoing credentials cannot leak them here.
    for (const [pattern,signal] of [
      [/invalid.{0,30}email|email.{0,30}invalid/i,'invalid_email'],
      [/invalid.{0,30}phone|phone.{0,30}invalid/i,'invalid_phone'],
      [/webhook.{0,40}(not found|invalid|does not exist)|(invalid|unknown).{0,20}webhook/i,'invalid_webhook'],
      [/workflow.{0,40}(inactive|not published|not found|disabled)/i,'workflow_unavailable'],
      [/unauthori[sz]ed|forbidden|authentication/i,'authentication_rejected'],
      [/rate.limit|too many requests/i,'rate_limited'],
    ] as const) if (pattern.test(raw)) {summary.signal=signal;break}
  } catch { summary.format='unreadable' }
  finally { if(timer) clearTimeout(timer);void reader.cancel().catch(()=>{}) }
  return summary
}
function text(value: unknown, max: number, required = false): string {
  if (value == null && !required) return ''
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value) || (required && !value.trim())) throw new Invalid()
  return value.trim()
}
export function normalize(raw: any) {
  if (!raw || raw.schemaVersion !== 1 || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw.requestId)) throw new Invalid()
  if (text(raw.website, 200) || (raw.price_status !== undefined && !statuses.includes(raw.price_status))) throw new Invalid()
  if (!Array.isArray(raw.attachments) || raw.attachments.length > 5) throw new Invalid()
  if (!Array.isArray(raw.services) || !raw.services.length || raw.services.length > serviceCatalog.length) throw new Invalid()
  const ids: string[] = raw.services.map((s: any) => text(s?.id, 40, true))
  if (new Set(ids).size !== ids.length || ids.some(id => !serviceCatalog.some(s => s.id === id))) throw new Invalid()
  const v = raw.vehicle, c = raw.contact, d = raw.details
  if (!v || !c || !d || raw.consent?.requestProcessing !== true) throw new Invalid()
  if (typeof v.mileage !== 'number' || !Number.isSafeInteger(v.mileage) || v.mileage < 0 || v.mileage > 9999999) throw new Invalid()
  if (v.year !== null && (!Number.isInteger(v.year) || v.year < 1900 || v.year > new Date().getFullYear() + 1)) throw new Invalid()
  const data: EstimateData = {
    registration: text(v.registration, 20, true), makeModel: text(v.makeModel, 150, true),
    year: v.year === null ? '' : String(v.year), mileage: String(v.mileage),
    vehicleType: v.type, fuelType: v.fuelType || '', selectedServices: ids,
    description: text(d.description, 5000), safeToDrive: text(d.safeToDrive, 30), files: [],
    name: text(c.name, 150, true), phone: text(c.phone, 40, true), email: text(c.email, 254),
    preferredTime: text(c.preferredTime, 200), contactMethod: c.preferredMethod, consent: true,
  }
  if (!['Puhelu','Tekstiviesti','Sähköposti'].includes(data.contactMethod) || !['','Bensiini','Diesel','Hybridi','Sähkö','En tiedä'].includes(data.fuelType) || !['','Kyllä','Ei','En osaa sanoa'].includes(data.safeToDrive)) throw new Invalid()
  for (let step = 0; step < 4; step++) if (Object.keys(validateStep(data, step)).length) throw new Invalid()
  const price = calculatePrice(data) // Ignore every browser-supplied amount/name/price flag.
  const price_status = price.requiresManualQuote ? statuses[2] : price.approximate ? statuses[1] : statuses[0]
  const names = data.name.split(/\s+/)
  const calculator_estimate = price.amount === null ? 'Pyydä hinta' : `${price.requiresManualQuote ? 'Hinnoiteltu osuus: ' : ''}${formatPrice({ amount: price.amount, approximate: price.approximate })}${price.requiresManualQuote ? '; muut työt: Pyydä hinta' : ''}`
  const extra = [data.description, `Ajoneuvotyyppi: ${data.vehicleType}`, data.fuelType && `Käyttövoima: ${data.fuelType}`, `Yhteydenottotapa: ${data.contactMethod}`, data.preferredTime && `Ajankohtatoive: ${data.preferredTime}`, data.safeToDrive && `Turvallista ajaa: ${data.safeToDrive}`].filter(Boolean).join('\n')
  return {
    first_name: names[0], last_name: names.slice(1).join(' '), email: data.email, phone: data.phone,
    license_plate: data.registration.toUpperCase(), vehicle_make_model: data.makeModel,
    vehicle_year: data.year, mileage: Number(data.mileage),
    selected_services: serviceCatalog.filter(s => ids.includes(s.id)).map(s => s.name).join(', '),
    additional_details: extra, calculator_estimate, price_status, request_id: raw.requestId,
  }
}
async function hash(value: string) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(b => b.toString(16).padStart(2, '0')).join('')
}
export default {
  async scheduled(_event: unknown, env: Env) { await deleteExpired(env) },
  async fetch(request: Request, env: Env): Promise<Response> {
    if (new URL(request.url).pathname.startsWith('/attachments/')) {
      try { return await imageRoute(request, env) } catch { return new Response('Unavailable', {status:503}) }
    }
    const origin = request.headers.get('Origin') || ''
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).includes(origin) && !!origin
    const headers: Record<string,string> = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin' }
    if (allowed) Object.assign(headers, { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Idempotency-Key', 'Access-Control-Max-Age': '600' })
    const reply = (status: number, code: string, requestId?: string) => Response.json({ accepted: status === 200, code, ...(requestId ? { requestId } : {}) }, { status, headers })
    if (!allowed) return reply(403, 'origin_denied')
    if (new URL(request.url).pathname !== '/api/estimate-request') return reply(404, 'not_found')
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    if (request.method !== 'POST') return reply(405, 'method_not_allowed')
    if (env.ESTIMATE_PUBLIC_ENABLED !== 'true') return reply(503, 'public_submission_disabled')
    const multipart = request.headers.get('Content-Type')?.startsWith('multipart/form-data')
    if (!multipart && !request.headers.get('Content-Type')?.startsWith('application/json')) return reply(415, 'json_required')
    try {
      if (!env.DB || !env.RATE_LIMIT_SALT || !env.GHL_WEBHOOK_URL) return reply(503, 'not_configured')
      const hook = new URL(env.GHL_WEBHOOK_URL)
      // Local mock URL is supported by local Wrangler; production must use HTTPS.
      if (hook.protocol !== 'https:' && !(hook.protocol === 'http:' && ['localhost','127.0.0.1'].includes(hook.hostname) && origin.startsWith('http://'))) return reply(503, 'not_configured')
      const ip = request.headers.get('CF-Connecting-IP') || (new URL(request.url).hostname === '127.0.0.1' || new URL(request.url).hostname === 'localhost' ? 'local' : '')
      if (!ip) return reply(503, 'not_configured')
      const now = Date.now(), bucket = `${Math.floor(now / 600000)}:${await hash(env.RATE_LIMIT_SALT + ip)}`
      const permit = await env.DB.prepare('INSERT INTO rate_limits(bucket,count,expires_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1 WHERE count<10 RETURNING count').bind(bucket, now + 1200000).first()
      if (!permit) return reply(429, 'rate_limited')
      const globalPermit = await env.DB.prepare('INSERT INTO rate_limits(bucket,count,expires_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1 WHERE count<1000 RETURNING count').bind(`global:${Math.floor(now/86400000)}`,now+172800000).first()
      if (!globalPermit) return reply(429, 'rate_limited')
      await env.DB.prepare('DELETE FROM rate_limits WHERE expires_at < ?').bind(now).run()
      const limit = multipart ? 51 * 1024 * 1024 : 32768
      if (Number(request.headers.get('Content-Length')) > limit) return reply(413, 'too_large')
      if (!request.body) return reply(400, 'invalid_request')
      let size = 0
      const limited = request.body.pipeThrough(new TransformStream<Uint8Array,Uint8Array>({transform(chunk, controller) {
        size += chunk.byteLength
        if (size > limit) throw new TooLarge()
        controller.enqueue(chunk)
      }}))
      let body: string, files: File[] = []
      if (multipart) {
        const form = await new Response(limited, {headers:{'Content-Type':request.headers.get('Content-Type')!}}).formData()
        const json = form.get('request')
        if (typeof json !== 'string' || json.length > 32768) return reply(422, 'invalid_request')
        body = json
        const incoming = form.getAll('images')
        if (incoming.some(f => typeof f === 'string')) return reply(422, 'invalid_images')
        files = incoming as File[]
      } else body = await new Response(limited).text()
      let payload
      let imageHashes: string[]
      try { const raw = JSON.parse(body); payload = normalize(raw); imageHashes = await validateImages(files, raw.attachments) } catch { return reply(422, 'invalid_request') }
      if (files.length && (!env.IMAGES || !env.ATTACHMENT_BASE_URL || !env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD || !env.ACCESS_ALLOWED_EMAIL)) return reply(503, 'attachments_unavailable')
      if (request.headers.get('Idempotency-Key') !== payload.request_id) return reply(422, 'invalid_request')
      const fingerprint = await hash(JSON.stringify({payload, imageHashes}))
      const claimed = await env.DB.prepare("INSERT INTO requests(request_id,fingerprint,status,created_at) VALUES(?,?,'pending',?) ON CONFLICT(request_id) DO NOTHING").bind(payload.request_id, fingerprint, now).run()
      if (!claimed.meta.changes) {
        const previous = await env.DB.prepare('SELECT fingerprint,status FROM requests WHERE request_id=?').bind(payload.request_id).first<{fingerprint:string;status:string}>()
        if (!previous || previous.fingerprint !== fingerprint) return reply(409, 'id_conflict')
        return previous.status === 'accepted' ? reply(200, 'accepted', payload.request_id) : reply(409, 'delivery_unconfirmed', payload.request_id)
      }
      let stage = 'r2_upload'
      const deliveryStarted = Date.now()
      try {
        if (files.length) {
          const imageBase = new URL(env.ATTACHMENT_BASE_URL)
          if (imageBase.protocol !== 'https:') throw new Error('configuration')
          const links = []
          for (let i=0;i<files.length;i++) {
            const key = `attachments/${payload.request_id}/${i}`
            await env.IMAGES.put(key, await files[i].arrayBuffer(), {httpMetadata:{contentType:files[i].type},customMetadata:{expires:String(now+retention)}})
            links.push(new URL('/'+key, imageBase).href)
          }
          payload.additional_details += '\nKuvaliitteet (kirjautuminen vaaditaan, säilytys 90 päivää):\n'+links.join('\n')
          await env.DB.prepare('UPDATE requests SET links=? WHERE request_id=?').bind(links.join('\n'),payload.request_id).run()
        }
        stage = 'ghl_fetch'
        const response = await fetch(hook, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(10000) })
        const acknowledgement=await safeResponseSummary(response)
        if (!response.ok || acknowledgement.successFlag===false) throw new UpstreamFailure(acknowledgement)
        console.info(JSON.stringify({event:'estimate_delivery_ack',...acknowledgement}))
        // A body cleanup failure must not invalidate an already received HTTP acknowledgement.
        void response.body?.cancel().catch(()=>{})
        stage = 'd1_accept'
        await env.DB.prepare("UPDATE requests SET status='accepted' WHERE request_id=?").bind(payload.request_id).run()
        return reply(200, 'accepted', payload.request_id)
      } catch (error) {
        console.warn(JSON.stringify({event:'estimate_delivery_failure',stage,elapsedMs:Date.now()-deliveryStarted,
          category:error instanceof UpstreamFailure?'http_error':error instanceof Error && ['TimeoutError','AbortError','TypeError'].includes(error.name)?error.name:'internal_error',
          ...(error instanceof UpstreamFailure?error.diagnostic:{}),
          target:{https:hook.protocol==='https:',knownGhlHost:['services.leadconnectorhq.com','services.msgsndr.com'].includes(hook.hostname),inboundPath:/^\/hooks\/[^/]+\/webhook-trigger\/[^/]+\/?$/.test(hook.pathname)}}))
        await env.DB.prepare("UPDATE requests SET status='uncertain' WHERE request_id=?").bind(payload.request_id).run()
        return reply(502, 'delivery_unconfirmed', payload.request_id)
      }
    } catch (error) { return error instanceof TooLarge ? reply(413, 'too_large') : reply(503, 'temporarily_unavailable') }
  },
}
