import { calculatePrice, getServicePrice, serviceCatalog, vehicleTypeOptions } from '../data/serviceCatalog'
import type { EstimateData } from '../types/estimate'

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024
export const MAX_IMAGES = 5
export function validateStep(data: EstimateData, step: number): Record<string, string> {
  const errors: Record<string, string> = {}
  if (step === 0) {
    if (!data.registration.trim()) errors.registration = 'Anna rekisterinumero.'
    if (!data.makeModel.trim()) errors.makeModel = 'Anna auton merkki ja malli.'
    if (!/^\d+$/.test(data.mileage)) errors.mileage = 'Anna mittarilukema kokonaislukuna (0 tai enemmän).'
    if (data.year && (!/^\d{4}$/.test(data.year) || Number(data.year) < 1900 || Number(data.year) > new Date().getFullYear() + 1)) errors.year = 'Tarkista vuosimalli.'
    if (!vehicleTypeOptions.some((option) => option.value === data.vehicleType)) errors.vehicleType = 'Valitse ajoneuvotyyppi.'
  }
  if (step === 1 && !data.selectedServices.some((id) => serviceCatalog.some((service) => service.id === id))) errors.services = 'Valitse vähintään yksi palvelu.'
  if (step === 2 && data.selectedServices.includes('other') && !data.description.trim()) errors.description = 'Kuvaile mitä autolle pitäisi tehdä tai mikä autossa on vikana.'
  if (step === 3) {
    if (!data.name.trim()) errors.name = 'Anna nimesi.'
    if (data.phone.replace(/\D/g, '').length < 6 || !/^\+?[\d\s()-]+$/.test(data.phone.trim())) errors.phone = 'Anna toimiva puhelinnumero.'
    if ((data.email.trim() || data.contactMethod === 'Sähköposti') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) errors.email = 'Anna toimiva sähköpostiosoite.'
    if (!data.consent) errors.consent = 'Hyväksy tietojesi käyttö pyynnön käsittelyyn.'
  }
  return errors
}
export function buildEstimateRequest(data: EstimateData) {
  const otherSelected = data.selectedServices.includes('other')
  return {
    schemaVersion: 1,
    requestId: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    vehicle: { registration: data.registration.trim().toUpperCase(), makeModel: data.makeModel.trim(), year: data.year ? Number(data.year) : null, mileage: Number(data.mileage), fuelType: data.fuelType || null, type: data.vehicleType },
    services: serviceCatalog.filter((service) => data.selectedServices.includes(service.id)).map((service) => ({ id: service.id, name: service.name, price: getServicePrice(service, data.vehicleType), requiresManualQuote: !getServicePrice(service, data.vehicleType), ...(service.id === 'other' ? { description: data.description.trim() } : {}) })),
    estimate: { ...calculatePrice(data), currency: 'EUR', finalPriceRequiresConfirmation: true },
    details: { description: data.description.trim(), safeToDrive: otherSelected ? data.safeToDrive || null : null },
    contact: { name: data.name.trim(), phone: data.phone.trim(), email: data.email.trim() || null, preferredMethod: data.contactMethod, preferredTime: data.preferredTime.trim() || null },
    consent: { requestProcessing: data.consent },
    attachments: data.files.map(({ file }) => ({ name: file.name, type: file.type, size: file.size })),
  }
}
export type EstimateRequest = ReturnType<typeof buildEstimateRequest>

// Use your own backend here. Forward to GHL on the server; never expose private webhook URLs or keys in VITE_*.
export async function submitEstimateRequest(request: EstimateRequest, files: EstimateData['files']): Promise<{ requestId: string }> {
  const body = new FormData()
  body.append('request', JSON.stringify(request))
  files.forEach(({ file }) => body.append('images', file, file.name))
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 20000)
  try {
    const response = await fetch(import.meta.env.VITE_ESTIMATE_API_URL || '/api/estimate-requests', { method: 'POST', body, signal: controller.signal, headers: { Accept: 'application/json', 'Idempotency-Key': request.requestId } })
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('Lähetys ei onnistunut. Vastaanottopalvelu ei ole käytettävissä. Tietosi säilyvät tässä näkymässä; voit yrittää uudelleen.')
    const result: unknown = await response.json()
    if (!result || typeof result !== 'object' || !('accepted' in result) || result.accepted !== true) throw new Error('Korjaamon vastaanottopalvelu ei vahvistanut pyyntöä. Yritä uudelleen.')
    return { requestId: 'requestId' in result && typeof result.requestId === 'string' ? result.requestId : request.requestId }
  } catch (error) {
    if (error instanceof Error && error.name !== 'TypeError' && error.name !== 'AbortError') throw error
    throw new Error('Lähetys ei onnistunut. Tarkista yhteys ja yritä uudelleen. Tietosi säilyvät tässä näkymässä.')
  } finally { window.clearTimeout(timeout) }
}
