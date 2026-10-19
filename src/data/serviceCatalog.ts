import type { EstimateData, PriceEstimate, ServiceDefinition, ServicePrice, VehicleType } from '../types/estimate'

export const vehicleTypeOptions: Array<{ value: VehicleType; label: string; description: string }> = [
  { value: 'passengerCar', label: 'Henkilöauto', description: 'Renkaanvaihto 30 €.' },
  { value: 'vanOrSUV', label: 'Pakettiauto / maasturi', description: 'Renkaanvaihto 40 €.' },
  { value: 'unknown', label: 'En osaa sanoa', description: 'Korjaamo tarkistaa ajoneuvotyypin ja renkaanvaihdon hinnan.' },
]
// Otalammen Autohuollon yrittäjän ilmoittamat hinnat. Muita töitä ei hinnoitella automaattisesti.
export const serviceCatalog: ServiceDefinition[] = [
  { id: 'oil', name: 'Öljyn ja öljynsuodattimen vaihto', description: 'Moottoriöljyn ja öljynsuodattimen vaihto.', icon: 'oil', price: { amount: 200, approximate: true } },
  { id: 'tires', name: 'Renkaanvaihto', description: 'Kausirenkaiden vaihto. Hinta määräytyy ajoneuvotyypin mukaan.', icon: 'tires', price: null, vehiclePrices: { passengerCar: { amount: 30, approximate: false }, vanOrSUV: { amount: 40, approximate: false } } },
  { id: 'inspection', name: 'Katsastustarkastus', description: 'Ajoneuvon tarkastus ennen katsastusta.', icon: 'inspection', price: { amount: 50, approximate: false } },
  { id: 'ac', name: 'Ilmastointihuolto', description: 'Auton ilmastointihuolto.', icon: 'ac', price: { amount: 80, approximate: false } },
  { id: 'other', name: 'Muu huolto tai korjaus', description: 'Esim. määräaikaishuolto, jarrutyöt, vian selvitys tai nelipyöräsuuntaus. Hinta tarkistetaan autokohtaisesti.', icon: 'other', price: null },
]
export function getServicePrice(service: ServiceDefinition, vehicleType: VehicleType | ''): ServicePrice | null {
  return service.vehiclePrices ? service.vehiclePrices[vehicleType || 'unknown'] ?? null : service.price
}
export function formatPrice(price: ServicePrice): string {
  return `${price.approximate ? 'n. ' : ''}${price.amount.toLocaleString('fi-FI')} €`
}
export function calculatePrice(data: Pick<EstimateData, 'selectedServices' | 'vehicleType'>): PriceEstimate {
  const chosen = serviceCatalog.filter((service) => data.selectedServices.includes(service.id))
  const pricedServices = chosen.flatMap((service) => {
    const price = getServicePrice(service, data.vehicleType)
    return price ? [{ id: service.id, name: service.name, ...price }] : []
  })
  const manualServices = chosen.filter((service) => !getServicePrice(service, data.vehicleType)).map((service) => service.name)
  return {
    amount: pricedServices.length ? pricedServices.reduce((sum, service) => sum + service.amount, 0) : null,
    approximate: pricedServices.some((service) => service.approximate),
    requiresManualQuote: manualServices.length > 0,
    manualServices,
    pricedServices,
  }
}
export function priceHeading(price: PriceEstimate): string {
  if (price.amount === null) return 'Hinta tarkistetaan autokohtaisesti'
  return `${price.requiresManualQuote ? 'Heti arvioitava osuus' : 'Arvioitu hinta'}: ${formatPrice({ amount: price.amount, approximate: price.approximate })}`
}
export const initialEstimateData: EstimateData = {
  registration: '', makeModel: '', year: '', mileage: '', fuelType: '', vehicleType: '',
  selectedServices: [], description: '', safeToDrive: '', files: [], name: '', phone: '', email: '',
  contactMethod: 'Puhelu', preferredTime: '', consent: false,
}
