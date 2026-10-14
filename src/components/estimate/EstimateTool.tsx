import { useMemo, useRef, useState } from 'react'
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2, CircleDot, ClipboardCheck, Droplets, FileImage, ImagePlus, LoaderCircle, Mail, Phone, RotateCcw, Snowflake, Trash2, UserRound, Wrench } from 'lucide-react'
import { calculatePrice, formatPrice, getServicePrice, initialEstimateData, priceHeading, serviceCatalog, vehicleTypeOptions } from '../../data/serviceCatalog'
import { buildEstimateRequest, MAX_IMAGE_BYTES, MAX_IMAGES, submitEstimateRequest, validateStep } from '../../lib/estimateRequest'
import type { EstimateRequest } from '../../lib/estimateRequest'
import type { EstimateData, FuelType, PriceEstimate } from '../../types/estimate'

const steps = ['Auto', 'Tarvittavat työt', 'Lisätiedot', 'Yhteystiedot', 'Yhteenveto']
const fuelTypes: FuelType[] = ['Bensiini', 'Diesel', 'Hybridi', 'Sähkö', 'En tiedä']
const serviceIcons = { oil: Droplets, tires: CircleDot, inspection: ClipboardCheck, ac: Snowflake, other: Wrench }
const otherExamples = ['Määräaikaishuolto', 'Jarrut', 'Muu korjaus', 'En tiedä mikä autossa on vikana']
const vehicleTypeLabel = (type: EstimateData['vehicleType']) => vehicleTypeOptions.find((option) => option.value === type)?.label ?? '—'
const formatFileSize = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} kt` : `${(bytes / 1024 / 1024).toFixed(1)} Mt`

function ErrorText({ id, children }: { id: string; children?: string }) {
  return children ? <p id={id} className="field-error" role="alert"><AlertTriangle aria-hidden="true" size={14} />{children}</p> : null
}
function FieldLabel({ htmlFor, required, children }: { htmlFor: string; required?: boolean; children: React.ReactNode }) {
  return <label htmlFor={htmlFor}>{children}{required && <span className="required-mark" aria-hidden="true"> *</span>}</label>
}
function StepProgress({ current }: { current: number }) {
  return <div className="progress-wrap">
    <p className="progress-mobile" aria-live="polite">Vaihe {current + 1}/5 · {steps[current]}</p>
    <ol className="progress-desktop" aria-label="Lomakkeen eteneminen">{steps.map((step, index) => <li key={step} className={index === current ? 'is-current' : index < current ? 'is-complete' : ''} aria-current={index === current ? 'step' : undefined}><span>{index < current ? <Check aria-hidden="true" size={13} /> : index + 1}</span><small>{step}</small></li>)}</ol>
  </div>
}
function PricePanel({ price, summary = false }: { price: PriceEstimate; summary?: boolean }) {
  return <aside className={`price-panel${summary ? ' price-panel-summary' : ''}`} aria-label="Hinta-arvio" aria-live="polite">
    <div className="price-result"><span className="price-label">Hinta-arvio</span><strong>{priceHeading(price)}</strong></div>
    {price.requiresManualQuote && price.amount !== null && <p className="manual-services">Muut valitut työt hinnoitellaan erikseen: {price.manualServices.join(', ')}. Korjaamo vahvistaa niiden hinnan erikseen.</p>}
    {price.requiresManualQuote && price.amount === null && <p>Korjaamo käy antamasi auton tiedot ja työn läpi ja vahvistaa hinnan ennen työn aloittamista.</p>}
    <p>Korjaamo vahvistaa lopullisen hinnan ennen työn aloittamista.</p>
  </aside>
}
function Summary({ data, price, onEdit, onSubmit, loading, submissionError }: { data: EstimateData; price: PriceEstimate; onEdit: () => void; onSubmit: () => void; loading: boolean; submissionError: string }) {
  const chosen = serviceCatalog.filter((service) => data.selectedServices.includes(service.id))
  return <div className="summary-view">
    <div className="step-heading"><span>Tarkista ennen lähettämistä</span><h2>Yhteenveto</h2><p>Tarkista auton tiedot, valitut palvelut ja yhteystietosi.</p></div>
    <section className="summary-section"><h3>Ajoneuvo</h3><dl className="summary-grid">
      <div><dt>Rekisterinumero</dt><dd>{data.registration}</dd></div><div><dt>Merkki ja malli</dt><dd>{data.makeModel}</dd></div>
      <div><dt>Vuosimalli</dt><dd>{data.year || '—'}</dd></div><div><dt>Mittarilukema</dt><dd>{Number(data.mileage).toLocaleString('fi-FI')} km</dd></div>
      <div><dt>Käyttövoima</dt><dd>{data.fuelType || '—'}</dd></div><div><dt>Ajoneuvotyyppi</dt><dd>{vehicleTypeLabel(data.vehicleType)}</dd></div>
    </dl></section>
    <section className="summary-section"><h3>Valitut palvelut</h3><ul className="selected-service-list">{chosen.map((service) => {
      const servicePrice = getServicePrice(service, data.vehicleType)
      return <li key={service.id}><Check aria-hidden="true" size={15} /><span className="service-line-copy"><strong>{service.name}</strong>{service.id === 'other' && <small className="other-description">{data.description}</small>}</span><span className="service-line-price">{servicePrice ? formatPrice(servicePrice) : 'Hinta tarkistetaan autokohtaisesti'}</span></li>
    })}</ul></section>
    <PricePanel price={price} summary />
    {(data.description || data.safeToDrive || data.files.length > 0) && <section className="summary-section"><h3>Lisätiedot</h3><dl className="summary-grid summary-grid-wide">
      {data.description && !data.selectedServices.includes('other') && <div><dt>Lisätiedot korjaamolle</dt><dd>{data.description}</dd></div>}
      {data.selectedServices.includes('other') && data.safeToDrive && <div><dt>Onko autolla turvallista ajaa?</dt><dd>{data.safeToDrive}</dd></div>}
      {data.files.length > 0 && <div><dt>Kuvat</dt><dd>{data.files.map(({ file }) => file.name).join(', ')}</dd></div>}
    </dl></section>}
    <section className="summary-section"><h3>Yhteystiedot</h3><dl className="summary-grid">
      <div><dt>Nimi</dt><dd>{data.name}</dd></div><div><dt>Puhelinnumero</dt><dd>{data.phone}</dd></div><div><dt>Sähköposti</dt><dd>{data.email || '—'}</dd></div>
      <div><dt>Toivottu yhteydenottotapa</dt><dd>{data.contactMethod}</dd></div><div><dt>Toivottu ajankohta</dt><dd>{data.preferredTime || '—'}</dd></div>
    </dl></section>
    <ErrorText id="submission-error">{submissionError}</ErrorText>
    <div className="form-actions"><button type="button" className="button secondary" onClick={onEdit} disabled={loading}><ArrowLeft aria-hidden="true" size={17} />Muokkaa tietoja</button><button type="button" className="button primary" onClick={onSubmit} disabled={loading}>{loading ? <><LoaderCircle className="spin" aria-hidden="true" size={18} />Lähetetään…</> : <>Lähetä huoltopyyntö<ArrowRight aria-hidden="true" size={18} /></>}</button></div>
  </div>
}

export function EstimateTool() {
  const [data, setData] = useState<EstimateData>({ ...initialEstimateData })
  const [step, setStep] = useState(0)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [receipt, setReceipt] = useState<string | null>(null)
  const [submissionError, setSubmissionError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const sendingRef = useRef(false)
  const pendingRequest = useRef<EstimateRequest | null>(null)
  const price = useMemo(() => calculatePrice(data), [data])
  const otherSelected = data.selectedServices.includes('other')
  const update = (partial: Partial<EstimateData>) => {
    pendingRequest.current = null
    setSubmissionError('')
    setData((current) => ({ ...current, ...partial }))
    setErrors((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !(key in partial))))
  }
  const focusCard = () => requestAnimationFrame(() => { const card = document.querySelector<HTMLElement>('.estimate-card'); card?.focus({ preventScroll: true }); card?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches || Boolean(card?.closest('[data-reduced-motion="true"]')) ? 'auto' : 'smooth' }) })
  const goTo = (target: number) => { setErrors({}); setStep(target); focusCard() }
  const validate = (target: number) => {
    const next = validateStep(data, target)
    setErrors(next)
    if (Object.keys(next).length) { requestAnimationFrame(() => document.getElementById(Object.keys(next)[0])?.focus()); return false }
    return true
  }
  const toggleService = (id: string) => {
    const selectedServices = data.selectedServices.includes(id) ? data.selectedServices.filter((item) => item !== id) : [...data.selectedServices, id]
    update({ selectedServices, ...(selectedServices.includes('other') ? {} : { safeToDrive: '' }) })
    setErrors((current) => ({ ...current, services: '', description: '' }))
  }
  const onFiles = (files: FileList | null) => {
    if (!files) return
    const incoming = Array.from(files)
    if (incoming.some((file) => !file.type.startsWith('image/') || file.size > MAX_IMAGE_BYTES) || incoming.length + data.files.length > MAX_IMAGES) {
      setErrors((current) => ({ ...current, imageUpload: 'Lisää enintään 5 kuvaa. Yhden kuvan enimmäiskoko on 10 Mt.' }))
    } else {
      update({ files: [...data.files, ...incoming.map((file) => ({ id: crypto.randomUUID(), file }))] })
      setErrors((current) => ({ ...current, imageUpload: '' }))
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }
  const submit = async () => {
    if (sendingRef.current) return
    for (let target = 0; target < 4; target++) {
      const next = validateStep(data, target)
      if (Object.keys(next).length) { goTo(target); setErrors(next); requestAnimationFrame(() => document.getElementById(Object.keys(next)[0])?.focus()); return }
    }
    sendingRef.current = true
    setLoading(true); setSubmissionError('')
    try {
      pendingRequest.current ??= buildEstimateRequest(data)
      const result = await submitEstimateRequest(pendingRequest.current, data.files)
      setReceipt(result.requestId); focusCard()
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : 'Lähetys ei onnistunut. Yritä uudelleen.')
    } finally { sendingRef.current = false; setLoading(false) }
  }
  const reset = () => { setData({ ...initialEstimateData }); setStep(0); setErrors({}); setReceipt(null); setSubmissionError(''); pendingRequest.current = null; focusCard() }
  if (receipt) return <article className="estimate-card success-card" tabIndex={-1} aria-live="polite">
    <div className="success-icon"><CheckCircle2 aria-hidden="true" size={34} /></div><span className="success-kicker">Pyyntö vastaanotettu</span><h2>Kiitos huoltopyynnöstä!</h2>
    <p>Otalammen Autohuolto käy pyyntösi läpi ja ottaa sinuun yhteyttä toivomallasi tavalla. Korjaamo vahvistaa lopullisen hinnan ennen työn aloittamista.</p>
    <p className="field-help">Pyynnön tunnus: {receipt}</p>
    <div className="success-actions"><button className="button secondary" type="button" onClick={reset}><RotateCcw aria-hidden="true" size={17} />Aloita uusi pyyntö</button></div>
  </article>
  return <article className="estimate-card" tabIndex={-1}>
    <div className="tool-topline"><div><span className="live-dot" aria-hidden="true" />Huollon hinta-arvio</div><span className="optional">5 selkeää vaihetta</span></div>
    <StepProgress current={step} />
    <div className="step-panel" key={step}>
      {step === 0 && <>
        <div className="step-heading"><span>Aloita ajoneuvosta</span><h2>Auton tiedot</h2><p>Korjaamo käyttää auton tietoja pyynnön ja tarvittavan työn tarkistamiseen.</p></div>
        <div className="field-grid">
          <div className="field"><FieldLabel htmlFor="registration" required>Rekisterinumero</FieldLabel><input id="registration" autoComplete="off" required maxLength={20} value={data.registration} onChange={(event) => update({ registration: event.target.value.toUpperCase() })} aria-invalid={Boolean(errors.registration)} aria-describedby="registration-help registration-error" /><p id="registration-help" className="field-help">Rekisterinumero kerätään korjaamon tarkistusta varten. Auton tietoja ei haeta automaattisesti.</p><ErrorText id="registration-error">{errors.registration}</ErrorText></div>
          <div className="field"><FieldLabel htmlFor="makeModel" required>Merkki ja malli</FieldLabel><input id="makeModel" required maxLength={150} value={data.makeModel} onChange={(event) => update({ makeModel: event.target.value })} aria-invalid={Boolean(errors.makeModel)} aria-describedby={errors.makeModel ? 'makeModel-error' : undefined} /><ErrorText id="makeModel-error">{errors.makeModel}</ErrorText></div>
          <div className="field"><FieldLabel htmlFor="year">Vuosimalli <span className="optional">(valinnainen)</span></FieldLabel><input id="year" type="number" inputMode="numeric" min="1900" max={new Date().getFullYear() + 1} value={data.year} onChange={(event) => update({ year: event.target.value })} aria-invalid={Boolean(errors.year)} aria-describedby={errors.year ? 'year-error' : undefined} /><ErrorText id="year-error">{errors.year}</ErrorText></div>
          <div className="field"><FieldLabel htmlFor="mileage" required>Mittarilukema</FieldLabel><div className="input-suffix"><input id="mileage" type="number" required inputMode="numeric" min="0" step="1" value={data.mileage} onChange={(event) => update({ mileage: event.target.value })} aria-invalid={Boolean(errors.mileage)} aria-describedby={errors.mileage ? 'mileage-error' : undefined} /><span>km</span></div><ErrorText id="mileage-error">{errors.mileage}</ErrorText></div>
          <div className="field full-field"><FieldLabel htmlFor="fuelType">Käyttövoima <span className="optional">(valinnainen)</span></FieldLabel><select id="fuelType" value={data.fuelType} onChange={(event) => update({ fuelType: event.target.value as FuelType })}><option value="">Valitse käyttövoima</option>{fuelTypes.map((fuel) => <option key={fuel}>{fuel}</option>)}</select><p className="field-help">Käyttövoima ei vaikuta tässä laskurissa hinta-arvioon.</p></div>
          <fieldset id="vehicleType" tabIndex={-1} className="field full-field vehicle-size-fieldset" aria-describedby="vehicle-type-help vehicleType-error">
            <legend>Ajoneuvotyyppi<span className="required-mark" aria-hidden="true"> *</span></legend>
            <div className="vehicle-size-grid">{vehicleTypeOptions.map((option) => <label key={option.value} className={`vehicle-size-option${data.vehicleType === option.value ? ' is-selected' : ''}`}><input type="radio" name="vehicleType" value={option.value} checked={data.vehicleType === option.value} onChange={() => update({ vehicleType: option.value })} /><span className="vehicle-radio" aria-hidden="true" /><span><strong>{option.label}</strong></span></label>)}</div>
            <p id="vehicle-type-help" className="field-help">Ajoneuvotyyppi auttaa korjaamoa arvioimaan työn ja hinnan oikein.</p><ErrorText id="vehicleType-error">{errors.vehicleType}</ErrorText>
          </fieldset>
        </div><div className="form-actions single-action"><button type="button" className="button primary" onClick={() => validate(0) && goTo(1)}>Jatka töihin<ArrowRight aria-hidden="true" size={18} /></button></div>
      </>}
      {step === 1 && <>
        <div className="step-heading"><span>Valitse yksi tai useampi</span><h2>Mitä autolle tarvitaan?</h2><p>Yleisimpien huoltojen hinnan näet heti. Valitse muille töille ”Muu huolto tai korjaus”.</p></div>
        <div className="service-grid" id="services" tabIndex={-1} aria-describedby={errors.services ? 'services-error' : undefined}>{serviceCatalog.map((service) => {
          const Icon = serviceIcons[service.icon]
          const checked = data.selectedServices.includes(service.id)
          const servicePrice = getServicePrice(service, data.vehicleType)
          return <label key={service.id} className={`service-option${checked ? ' is-selected' : ''}${service.id === 'other' ? ' service-option-wide' : ''}`}><input type="checkbox" checked={checked} onChange={() => toggleService(service.id)} /><span className="service-check"><Check aria-hidden="true" size={13} /></span><Icon aria-hidden="true" size={19} /><span><strong>{service.name}</strong><small>{servicePrice ? formatPrice(servicePrice) : service.id === 'tires' ? 'Valitse ajoneuvotyyppi hinnan laskemiseksi' : 'Hinta tarkistetaan autokohtaisesti'}</small>{service.id === 'other' && <small>{service.description}</small>}</span></label>
        })}</div><ErrorText id="services-error">{errors.services}</ErrorText>
        {data.selectedServices.length > 0 && <PricePanel price={price} />}
        <div className="form-actions"><button type="button" className="button secondary" onClick={() => goTo(0)}><ArrowLeft aria-hidden="true" size={17} />Takaisin</button><button type="button" className="button primary" onClick={() => validate(1) && goTo(2)}>Jatka lisätietoihin<ArrowRight aria-hidden="true" size={18} /></button></div>
      </>}
      {step === 2 && <>
        <div className="step-heading"><span>Vain olennaiset tiedot</span><h2>Lisätiedot</h2><p>{otherSelected ? 'Kuvaile muun huollon tai korjauksen tarve, jotta korjaamo voi arvioida työn.' : 'Voit halutessasi jättää lisätietoja tai lisätä kuvan. Muuten voit jatkaa suoraan yhteystietoihin.'}</p></div>
        <div className="field-grid">
          {otherSelected && <div className="field full-field"><span className="label-like">Esimerkkejä työn kuvaukseen</span><div className="quick-options">{otherExamples.map((example) => <button type="button" className="button secondary" key={example} onClick={() => { update({ description: data.description.trim() ? `${data.description}\n${example}` : example }); document.getElementById('description')?.focus() }}>{example}</button>)}</div></div>}
          <div className={`field full-field${otherSelected ? ' emphasized-field' : ''}`}><FieldLabel htmlFor="description" required={otherSelected}>{otherSelected ? 'Kuvaile mitä autolle pitäisi tehdä tai mikä autossa on vikana.' : 'Lisätiedot korjaamolle'} {!otherSelected && <span className="optional">(valinnainen)</span>}</FieldLabel><textarea id="description" rows={otherSelected ? 4 : 3} required={otherSelected} maxLength={5000} value={data.description} onChange={(event) => update({ description: event.target.value })} aria-invalid={Boolean(errors.description)} aria-describedby={errors.description ? 'description-error' : undefined} /><ErrorText id="description-error">{errors.description}</ErrorText></div>
          {otherSelected && <fieldset className="field full-field inline-choice-fieldset"><legend>Onko autolla tällä hetkellä turvallista ajaa? <span className="optional">(valinnainen)</span></legend><div className="segmented-options">{['Kyllä', 'Ei', 'En osaa sanoa'].map((option) => <label key={option}><input type="radio" name="safeToDrive" checked={data.safeToDrive === option} onChange={() => update({ safeToDrive: option })} /><span>{option}</span></label>)}</div></fieldset>}
          <div className="field full-field upload-field"><span className="label-like">Kuvien lisääminen <span className="optional">(valinnainen)</span></span><input ref={fileInputRef} id="imageUpload" className="visually-hidden" type="file" accept="image/*" multiple onChange={(event) => onFiles(event.target.files)} aria-describedby="imageUpload-help imageUpload-error" /><label htmlFor="imageUpload" className="upload-drop"><ImagePlus aria-hidden="true" size={22} /><span><strong>Valitse kuvia</strong><small id="imageUpload-help">Enintään 5 kuvaa, korkeintaan 10 Mt / kuva.</small></span></label><ErrorText id="imageUpload-error">{errors.imageUpload}</ErrorText>{data.files.length > 0 && <ul className="file-list">{data.files.map((item) => <li key={item.id}><FileImage aria-hidden="true" size={17} /><span><strong>{item.file.name}</strong><small>{formatFileSize(item.file.size)}</small></span><button type="button" className="icon-button" aria-label={`Poista ${item.file.name}`} onClick={() => { update({ files: data.files.filter((file) => file.id !== item.id) }); setErrors((current) => ({ ...current, imageUpload: '' })) }}><Trash2 aria-hidden="true" size={16} /></button></li>)}</ul>}</div>
        </div><div className="form-actions"><button type="button" className="button secondary" onClick={() => goTo(1)}><ArrowLeft aria-hidden="true" size={17} />Takaisin</button><button type="button" className="button primary" onClick={() => validate(2) && goTo(3)}>Jatka yhteystietoihin<ArrowRight aria-hidden="true" size={18} /></button></div>
      </>}
      {step === 3 && <>
        <div className="step-heading"><span>Viimeinen vaihe ennen tarkistusta</span><h2>Yhteystiedot</h2><p>Jätä yhteystietosi, jotta korjaamo voi tarkistaa pyynnön kanssasi.</p></div>
        <div className="field-grid">
          <div className="field"><FieldLabel htmlFor="name" required>Nimi</FieldLabel><div className="input-with-icon"><UserRound aria-hidden="true" size={17} /><input id="name" required autoComplete="name" maxLength={150} value={data.name} onChange={(event) => update({ name: event.target.value })} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'name-error' : undefined} /></div><ErrorText id="name-error">{errors.name}</ErrorText></div>
          <div className="field"><FieldLabel htmlFor="phone" required>Puhelinnumero</FieldLabel><div className="input-with-icon"><Phone aria-hidden="true" size={17} /><input id="phone" required type="tel" autoComplete="tel" maxLength={40} value={data.phone} onChange={(event) => update({ phone: event.target.value })} aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? 'phone-error' : undefined} /></div><ErrorText id="phone-error">{errors.phone}</ErrorText></div>
          <div className="field"><FieldLabel htmlFor="email" required={data.contactMethod === 'Sähköposti'}>Sähköposti {data.contactMethod !== 'Sähköposti' && <span className="optional">(valinnainen)</span>}</FieldLabel><div className="input-with-icon"><Mail aria-hidden="true" size={17} /><input id="email" type="email" autoComplete="email" maxLength={254} required={data.contactMethod === 'Sähköposti'} value={data.email} onChange={(event) => update({ email: event.target.value })} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'email-error' : undefined} /></div><ErrorText id="email-error">{errors.email}</ErrorText></div>
          <div className="field"><label htmlFor="preferredTime">Toivottu ajankohta <span className="optional">(valinnainen)</span></label><input id="preferredTime" maxLength={200} value={data.preferredTime} onChange={(event) => update({ preferredTime: event.target.value })} /></div>
          <fieldset className="field full-field inline-choice-fieldset"><legend>Toivottu yhteydenottotapa</legend><div className="segmented-options">{(['Puhelu', 'Tekstiviesti', 'Sähköposti'] as const).map((method) => <label key={method}><input type="radio" name="contactMethod" value={method} checked={data.contactMethod === method} onChange={() => update({ contactMethod: method })} /><span>{method}</span></label>)}</div>{data.contactMethod === 'Sähköposti' && <p className="field-help">Sähköpostiosoite tarvitaan, kun toivot yhteydenottoa sähköpostitse.</p>}</fieldset>
          <div className="field full-field"><label className={`consent-row${errors.consent ? ' has-error' : ''}`} htmlFor="consent"><input id="consent" type="checkbox" required checked={data.consent} onChange={(event) => update({ consent: event.target.checked })} aria-invalid={Boolean(errors.consent)} aria-describedby={errors.consent ? 'consent-error' : undefined} /><span>Hyväksyn antamieni tietojen käytön huoltopyynnön käsittelyyn ja yhteydenottoon.<span className="required-mark" aria-hidden="true"> *</span></span></label><ErrorText id="consent-error">{errors.consent}</ErrorText></div>
        </div><div className="form-actions"><button type="button" className="button secondary" onClick={() => goTo(2)}><ArrowLeft aria-hidden="true" size={17} />Takaisin</button><button type="button" className="button primary" onClick={() => validate(3) && goTo(4)}>Tarkista pyyntö<ArrowRight aria-hidden="true" size={18} /></button></div>
      </>}
      {step === 4 && <Summary data={data} price={price} onEdit={() => goTo(0)} onSubmit={submit} loading={loading} submissionError={submissionError} />}
    </div>
  </article>
}
