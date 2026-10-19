import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const html = read('index.html')
const tool = read('src/components/estimate/EstimateTool.tsx')

test('omistajan kahdeksan palveluryhmää säilyvät nykyisessä kuuden kortin rakenteessa', () => {
  assert.equal((html.match(/<article class="workshop-service">/g) || []).length, 6)
  for (const title of ['Huollot ja korjaukset', 'Rengasmyynti ja rengastyöt', 'Ilmastointihuollot ja -korjaukset', 'Katsastuspalvelut', 'Vikakoodit ja vianetsintä', 'Nelipyöräsuuntaukset']) assert.ok(html.includes(`<h3>${title}</h3>`), title)
  assert.ok(html.includes('ajovaloumpioiden pinnoitukset sekä hitsaus- ja korityöt'))
  assert.ok(html.includes('data-count="19" data-suffix="+"'))
  assert.ok(html.includes('19 Google-arvostelua'))
  assert.ok(html.includes('4,9 / 5'))
  assert.ok(html.includes('<strong>KAIKKI MERKIT</strong>'))
  assert.ok(!html.includes('n. 1 min'))
  assert.ok(!/Aulis|TORQUE|20 Google-arvostelua/i.test(html))
  for (const text of ['Ilmastointihuolto 80 €', 'Katsastustarkastus 50 €', '<p>Renkaanvaihto</p><ul><li>Henkilöauto 30 €</li><li>Pakettiauto / maasturi 40 €</li></ul>', '044 095 0100', 'Kehätie 2190 B, 03400 Vihti', 'Y-tunnus: 2559973-4']) assert.ok(html.includes(text), text)
  assert.ok(html.includes('href="tel:+358440950100"'))
})

test('manuaalisen työn esimerkit, neutraali ajoneuvo-ohje ja backend-varoitus säilyvät', () => {
  for (const example of ['Määräaikaishuolto', 'Jarrutyöt', 'Vikakoodit ja vian selvitys', 'Nelipyöräsuuntaus', 'Ajovaloumpioiden pinnoitus', 'Hitsaus- ja korityöt', 'Muu korjaus']) assert.ok(tool.includes(`'${example}'`), example)
  assert.ok(tool.includes('Ajoneuvotyyppi auttaa korjaamoa arvioimaan työn ja hinnan oikein.'))
  assert.ok(tool.includes('95 €/h, osat erikseen'))
  assert.ok(html.includes('Huoltopyyntöjen vastaanottopalvelua ei ole vielä liitetty.'))
  assert.ok(html.includes('Huollatteko kaikkia automerkkejä?'))
  assert.ok(html.includes('Myyttekö myös renkaita?'))
})
