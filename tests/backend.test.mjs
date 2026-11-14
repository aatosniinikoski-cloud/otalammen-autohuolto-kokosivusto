import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'
import {getPlatformProxy} from 'wrangler'
import {createServer} from 'node:http'
import {generateKeyPair, exportJWK, SignJWT} from 'jose'

const moduleURL = source => 'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64')
const read = path => readFile(new URL('../'+path,import.meta.url),'utf8')
const catalogURL=moduleURL(await read('src/data/serviceCatalog.ts'))
const requestsURL=moduleURL((await read('src/lib/estimateRequest.ts')).replace("'../data/serviceCatalog'",JSON.stringify(catalogURL)).replace('import.meta.env','({})'))
const imagesURL=moduleURL((await read('backend/images.ts')).replace("'jose'",JSON.stringify(import.meta.resolve('jose'))))
const workerURL=moduleURL((await read('backend/worker.ts')).replace("'../src/data/serviceCatalog'",JSON.stringify(catalogURL)).replace("'../src/lib/estimateRequest'",JSON.stringify(requestsURL)).replace("'./images'",JSON.stringify(imagesURL)))
const {default:worker,safeResponseSummary}=await import(workerURL)
const {buildEstimateRequest}=await import(requestsURL)
const {initialEstimateData}=await import(catalogURL)
const valid=()=>buildEstimateRequest({...initialEstimateData,registration:'TEST-123',makeModel:'Testiauto',year:'2018',mileage:'92000',vehicleType:'passengerCar',selectedServices:['oil'],name:'Testi Asiakas',phone:'0401234567',consent:true})

test('upstream diagnostics never expose response secrets and preserve HTTP status',async()=>{
  const secret='https://secret.example/private-token?key=do-not-log'
  const summary=await safeResponseSummary(Response.json({message:'Invalid webhook URL '+secret,error:secret},{status:404}))
  assert.equal(summary.httpStatus,404);assert.equal(summary.format,'json');assert.equal(summary.signal,'invalid_webhook')
  assert.equal(JSON.stringify(summary).includes(secret),false);assert.equal(JSON.stringify(summary).includes('private-token'),false)
  const redirected=await safeResponseSummary(new Response('moved '+secret,{status:302,headers:{Location:secret}}))
  assert.equal(redirected.httpStatus,302);assert.equal(JSON.stringify(redirected).includes(secret),false)
  const large=await safeResponseSummary(new Response('x'.repeat(10000),{status:500}))
  assert.equal(large.inspectedBytes,4096)
})

test('Worker + oikea paikallinen D1/R2, mockattu GHL; ei ulkoisia lähetyksiä', async t=>{
  const platform=await getPlatformProxy({configPath:'backend/wrangler.toml',persist:false})
  const env={...platform.env,GHL_WEBHOOK_URL:'https://mock.example/webhook',RATE_LIMIT_SALT:'test-only-salt',ATTACHMENT_BASE_URL:'https://images.example',ACCESS_TEAM_DOMAIN:'test.cloudflareaccess.com',ACCESS_AUD:'test-aud',ACCESS_ALLOWED_EMAIL:'owner@example.test'}
  env.ESTIMATE_PUBLIC_ENABLED='true'
  for (const sql of (await read('backend/schema.sql')).split(';').filter(s=>s.trim())) await env.DB.prepare(sql).run()
  const originalFetch=globalThis.fetch
  const keys=await generateKeyPair('RS256'), publicKey={...await exportJWK(keys.publicKey),kid:'test-key',alg:'RS256'}
  const token=await new SignJWT({email:'owner@example.test'}).setProtectedHeader({alg:'RS256',kid:'test-key'}).setIssuer('https://test.cloudflareaccess.com').setAudience('test-aud').setIssuedAt().setExpirationTime('5m').sign(keys.privateKey)
  let calls=[], mode='ok'
  const mockServer=createServer(async(req,res)=>{
    let body='';for await(const chunk of req) body+=chunk
    calls.push(JSON.parse(body))
    res.writeHead(mode==='error'?500:200,{'Content-Type':'application/json'}).end('{}')
  })
  await new Promise(resolve=>mockServer.listen(0,'127.0.0.1',resolve))
  const mockURL=`http://127.0.0.1:${mockServer.address().port}/webhook`
  globalThis.fetch=async (url,options)=>{
    if(String(url)==='https://test.cloudflareaccess.com/cdn-cgi/access/certs') return Response.json({keys:[publicKey]})
    assert.equal(String(url),'https://mock.example/webhook')
    if(mode==='semantic-error') {calls.push(JSON.parse(options.body));return Response.json({success:false,message:'Invalid webhook URL https://secret.example/never-log'},{status:200})}
    if(mode==='redirect') {calls.push(JSON.parse(options.body));assert.equal(options.redirect,'manual');return new Response('Moved',{status:302,headers:{Location:'https://secret.example/never-follow'}})}
    if(mode==='cancel-error') {calls.push(JSON.parse(options.body));return new Response(new ReadableStream({cancel(){return Promise.reject(new Error('cleanup failed'))}}),{status:200})}
    if(mode==='timeout') {calls.push(JSON.parse(options.body));throw new DOMException('timeout','TimeoutError')}
    return originalFetch(mockURL,options)
  }
  const send=(raw,images=[],origin='http://127.0.0.1:4179')=>{
    let body=JSON.stringify(raw), headers={'Origin':origin,'Content-Type':'application/json','Idempotency-Key':raw.requestId}
    if(images.length){body=new FormData();body.append('request',JSON.stringify(raw));images.forEach(f=>body.append('images',f,f.name));delete headers['Content-Type']}
    return worker.fetch(new Request('http://localhost/api/estimate-request',{method:'POST',headers,body}),{ESTIMATE_PUBLIC_ENABLED:'true',...env})
  }
  const reset=async()=>{calls=[];mode='ok';await env.DB.prepare('DELETE FROM rate_limits').run()}
  try {
    await t.test('palvelimen hinnat, kolme statusta ja erillinen vuosimalli/km',async()=>{
      for(const [services,status,amount] of [[['tires','ac'],'Kiinteä hinta','110 €'],[['oil'],'Suuntaa-antava arvio','n. 200 €'],[['maintenance'],'Vaatii hinnoittelun','Pyydä hinta'],[['oil','maintenance'],'Vaatii hinnoittelun','Hinnoiteltu osuus: n. 200 €; muut työt: Pyydä hinta']]){
        const raw=valid();raw.services=services.map(id=>({id,price:{amount:1}}));raw.estimate.amount=1
        assert.equal((await send(raw)).status,200)
        assert.equal(calls.at(-1).price_status,status);assert.equal(calls.at(-1).calculator_estimate,amount)
        assert.equal(calls.at(-1).vehicle_year,'2018');assert.equal(calls.at(-1).mileage,92000)
        assert.deepEqual(Object.keys(calls.at(-1)).sort(),['first_name','last_name','email','phone','license_plate','vehicle_make_model','vehicle_year','mileage','selected_services','additional_details','calculator_estimate','price_status','request_id'].sort())
      }
    })
    await reset()
    await t.test('pakolliset tiedot, puhelin, sähköposti, vuodet/km ja price_status',async()=>{
      for(const mutate of [r=>r.contact.name='',r=>r.contact.phone='abc',r=>r.contact.email='bad',r=>r.vehicle.year=1800,r=>r.vehicle.mileage=-1,r=>r.price_status='fake',r=>r.services=[{id:'fake'}],r=>r.consent.requestProcessing=false]){const raw=valid();mutate(raw);assert.equal((await send(raw)).status,422)}
      assert.equal(calls.length,0)
    })
    await reset()
    await t.test('pysyvä deduplikointi myös samanaikaisille pyynnöille ja ristiriidalle',async()=>{
      const raw=valid(), results=await Promise.all([send(raw),send(raw),send(raw)])
      assert.equal(calls.length,1);assert.ok(results.some(r=>r.status===200))
      assert.equal((await send(raw)).status,200)
      raw.vehicle.makeModel='Changed';assert.equal((await send(raw)).status,409);assert.equal(calls.length,1)
    })
    await reset()
    await t.test('successful upstream acknowledgement survives body cleanup failure',async()=>{
      mode='cancel-error';const raw=valid();assert.equal((await send(raw)).status,200)
      assert.equal((await send(raw)).status,200);assert.equal(calls.length,1)
    })
    await reset()
    await t.test('explicit upstream failure in HTTP 200 and redirects never become success',async()=>{
      for(const failure of ['semantic-error','redirect']){
        mode=failure;const raw=valid();assert.equal((await send(raw)).status,502)
        const n=calls.length;assert.equal((await send(raw)).status,409);assert.equal(calls.length,n)
      }
    })
    await reset()
    await t.test('GHL-virhe ja timeout lukitaan epäselväksi, ei uutta GHL-POSTia',async()=>{
      for(const failure of ['error','timeout']){mode=failure;const raw=valid();assert.equal((await send(raw)).status,502);const n=calls.length;assert.equal((await send(raw)).status,409);assert.equal(calls.length,n)}
    })
    await reset()
    await t.test('kuva yksityiseen R2:een, suojattu linkki lisätiedoissa, kirjautuminen vaaditaan',async()=>{
      const file=new File([new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0])],'test.png',{type:'image/png'}),raw=valid()
      raw.attachments=[{name:file.name,type:file.type,size:file.size}]
      assert.equal((await send(raw,[file])).status,200)
      assert.ok(calls[0].additional_details.includes(`https://images.example/attachments/${raw.requestId}/0`))
      assert.ok(await env.IMAGES.get(`attachments/${raw.requestId}/0`))
      assert.equal((await worker.fetch(new Request(`https://images.example/attachments/${raw.requestId}/0`),env)).status,401)
      const view=()=>new Request(`https://images.example/attachments/${raw.requestId}/0`,{headers:{'Cf-Access-Jwt-Assertion':token}})
      assert.equal((await worker.fetch(view(),env)).status,200)
      const signClaims=(claims,issuer='https://test.cloudflareaccess.com',audience='test-aud',expires='5m')=>new SignJWT(claims).setProtectedHeader({alg:'RS256',kid:'test-key'}).setIssuer(issuer).setAudience(audience).setIssuedAt().setExpirationTime(expires).sign(keys.privateKey)
      for (const [jwt,status] of [
        [await signClaims({email:'other@example.test'}),403],
        [await signClaims({}),401],
        [await signClaims({email:'owner@example.test'},'https://wrong.cloudflareaccess.com'),401],
        [await signClaims({email:'owner@example.test'},undefined,'wrong-aud'),401],
        [await signClaims({email:'owner@example.test'},undefined,undefined,'-1m'),401],
      ]) {
        const denied=view();denied.headers.set('Cf-Access-Jwt-Assertion',jwt);assert.equal((await worker.fetch(denied,env)).status,status)
      }
      assert.equal((await worker.fetch(view(),{...env,ACCESS_AUD:''})).status,503)
      const invalid=view();invalid.headers.set('Cf-Access-Jwt-Assertion',token+'bad');assert.equal((await worker.fetch(invalid,env)).status,401)
      await env.IMAGES.put(`attachments/${raw.requestId}/0`,await file.arrayBuffer(),{customMetadata:{expires:'1'}})
      assert.equal((await worker.fetch(view(),env)).status,404)
      assert.equal((await worker.fetch(new Request(view(),{method:'DELETE'}),env)).status,204)
      assert.equal(await env.IMAGES.get(`attachments/${raw.requestId}/0`),null)
      const originalBucket=env.IMAGES;env.IMAGES={...originalBucket,put:async()=>{throw new Error('disk')}}
      raw.requestId=crypto.randomUUID();const n=calls.length;assert.equal((await send(raw,[file])).status,502);assert.equal(calls.length,n);env.IMAGES=originalBucket
      const expiryKey=`attachments/${crypto.randomUUID()}/0`
      await env.IMAGES.put(expiryKey,await file.arrayBuffer())
      const clock=Date.now
      try {Date.now=()=>clock()+91*86400000;await worker.scheduled({},env)} finally {Date.now=clock}
      assert.equal(await env.IMAGES.get(expiryKey),null)
    })
    await reset()
    await t.test('CORS, honeypot, bodyraja ja atominen IP-rajoitus',async()=>{
      const pages = 'https://aatosniinikoski-cloud.github.io'
      env.ESTIMATE_PUBLIC_ENABLED='false'
      assert.equal((await send(valid(),[],pages)).status,503)
      assert.equal((await send(valid())).status,503)
      assert.equal(calls.length,0)
      env.ESTIMATE_PUBLIC_ENABLED='true'
      assert.equal((await send(valid(),[],'https://evil.example')).status,403)
      const bot=valid();bot.website='spam';assert.equal((await send(bot)).status,422)
      await reset();for(let i=0;i<10;i++) assert.equal((await send(valid())).status,200)
      assert.equal((await send(valid())).status,429)
      await reset();const large=valid();large.details.description='x'.repeat(40000);assert.equal((await send(large)).status,413)
      const badImage=valid();badImage.attachments=[{name:'bad.svg',type:'image/svg+xml',size:20}];assert.equal((await send(badImage,[new File(['<svg/>'],'bad.svg',{type:'image/svg+xml'})])).status,422)
    })
  } finally {globalThis.fetch=originalFetch;await platform.dispose();await new Promise(resolve=>mockServer.close(resolve))}
})
