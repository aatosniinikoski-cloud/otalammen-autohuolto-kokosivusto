import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

// Run the real TypeScript logic without adding another test framework.
const asModule = (source) => 'data:text/javascript;base64,' + Buffer.from(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString('base64')
const catalogURL = asModule(await readFile(new URL('../src/data/serviceCatalog.ts', import.meta.url), 'utf8'))
const catalog = await import(catalogURL)
const requestSource = (await readFile(new URL('../src/lib/estimateRequest.ts', import.meta.url), 'utf8')).replace("'../data/serviceCatalog'", JSON.stringify(catalogURL)).replace('import.meta.env', '({})')
const request = await import(asModule(requestSource))
const valid = { ...catalog.initialEstimateData, registration: 'TEST-123', makeModel: 'Testiauto', mileage: '100000', vehicleType: 'passengerCar', selectedServices: ['oil'], name: 'Testiasiakas', phone: '040 123 4567', consent: true }

test('yrittäjän esimerkit ja manuaaliset työt', () => {
  const heading = (selectedServices, vehicleType = 'passengerCar') => catalog.priceHeading(catalog.calculatePrice({ selectedServices, vehicleType }))
  assert.equal(heading(['oil', 'ac']), 'Arvioitu hinta: n. 280 €')
  assert.equal(heading(['tires', 'inspection']), 'Arvioitu hinta: 80 €')
  assert.equal(heading(['tires', 'inspection'], 'vanOrSUV'), 'Arvioitu hinta: 90 €')
  assert.equal(heading(['oil', 'other']), 'Heti arvioitava osuus: n. 200 €')
  assert.equal(heading(['other']), 'Hinta tarkistetaan autokohtaisesti')
  assert.equal(heading(['tires'], 'unknown'), 'Hinta tarkistetaan autokohtaisesti')
  assert.equal(heading(['tires', 'ac'], 'unknown'), 'Heti arvioitava osuus: 80 €')
})
test('kaikki 96 palveluyhdistelmää kolmelle ajoneuvotyypille', () => {
  const ids = ['oil', 'tires', 'inspection', 'ac', 'other']
  for (const vehicleType of ['passengerCar', 'vanOrSUV', 'unknown']) {
    for (let mask = 0; mask < 32; mask++) {
      const selectedServices = ids.filter((_, i) => mask & (1 << i))
      const amounts = { oil: 200, tires: vehicleType === 'passengerCar' ? 30 : vehicleType === 'vanOrSUV' ? 40 : null, inspection: 50, ac: 80, other: null }
      const priced = selectedServices.map((id) => amounts[id]).filter((value) => value !== null)
      const price = catalog.calculatePrice({ selectedServices, vehicleType })
      assert.equal(price.amount, priced.length ? priced.reduce((sum, value) => sum + value, 0) : null)
      assert.equal(price.approximate, selectedServices.includes('oil'))
      assert.equal(price.requiresManualQuote, selectedServices.some((id) => amounts[id] === null))
    }
  }
})
test('validointi: vapaaehtoiset lisätiedot, muu työ, puhelin ja sähköposti', () => {
  for (let step = 0; step < 4; step++) assert.deepEqual(request.validateStep(valid, step), {})
  assert.ok(request.validateStep({ ...valid, mileage: '-1' }, 0).mileage)
  assert.ok(request.validateStep({ ...valid, selectedServices: [] }, 1).services)
  assert.ok(request.validateStep({ ...valid, selectedServices: ['other'], description: '  ' }, 2).description)
  assert.ok(request.validateStep({ ...valid, phone: '', contactMethod: 'Sähköposti', email: 'test@example.com' }, 3).phone)
  assert.ok(request.validateStep({ ...valid, contactMethod: 'Sähköposti' }, 3).email)
  assert.ok(request.validateStep({ ...valid, email: 'virhe' }, 3).email)
  assert.ok(request.validateStep({ ...valid, consent: false }, 3).consent)
})
test('jäsennelty pyyntö sisältää manuaalisen työn, puhtaat tiedot ja liitteet', () => {
  const payload = request.buildEstimateRequest({ ...valid, selectedServices: ['oil', 'other'], description: ' Jarrut täristävät. ', safeToDrive: 'Ei', files: [{ id: 'test', file: new File(['image'], 'jarrut.png', { type: 'image/png' }) }] })
  assert.equal(payload.estimate.amount, 200)
  assert.equal(payload.services[1].price, null)
  assert.equal(payload.services[1].description, 'Jarrut täristävät.')
  assert.equal(payload.details.safeToDrive, 'Ei')
  assert.equal(payload.contact.email, null)
  assert.equal(payload.attachments[0].name, 'jarrut.png')
})
test('lähetys: multipart, kuittaus, virheet ja puuttuva backend', async () => {
  const savedFetch = globalThis.fetch
  const savedWindow = globalThis.window
  globalThis.window = { setTimeout, clearTimeout }
  const payload = request.buildEstimateRequest(valid)
  try {
    globalThis.fetch = async (url, init) => {
      assert.equal(url, '/api/estimate-requests')
      assert.equal(init.headers['Idempotency-Key'], payload.requestId)
      assert.equal(JSON.parse(init.body.get('request')).vehicle.registration, 'TEST-123')
      return Response.json({ accepted: true, requestId: 'accepted-test' }, { status: 201 })
    }
    assert.deepEqual(await request.submitEstimateRequest(payload, []), { requestId: 'accepted-test' })
    for (const response of [new Response('<html>Vite</html>', { headers: { 'Content-Type': 'text/html' } }), Response.json({ accepted: false }), new Response('Error', { status: 500 })]) {
      globalThis.fetch = async () => response
      await assert.rejects(request.submitEstimateRequest(payload, []))
    }
    globalThis.fetch = async () => { throw new TypeError('Network failed') }
    await assert.rejects(request.submitEstimateRequest(payload, []), /Lähetys ei onnistunut/)
  } finally { globalThis.fetch = savedFetch; globalThis.window = savedWindow }
})
