export type FuelType = 'Bensiini' | 'Diesel' | 'Hybridi' | 'Sähkö' | 'En tiedä'
export type ContactMethod = 'Puhelu' | 'Tekstiviesti' | 'Sähköposti'
export type VehicleType = 'passengerCar' | 'vanOrSUV' | 'unknown'
export interface ServicePrice { amount: number; approximate: boolean }
export interface ServiceDefinition {
  id: string
  name: string
  description: string
  icon: 'oil' | 'tires' | 'inspection' | 'ac' | 'other'
  price: ServicePrice | null
  vehiclePrices?: Partial<Record<VehicleType, ServicePrice>>
}
export interface UploadFile { id: string; file: File }
export interface EstimateData {
  registration: string
  makeModel: string
  year: string
  mileage: string
  fuelType: FuelType | ''
  vehicleType: VehicleType | ''
  selectedServices: string[]
  description: string
  safeToDrive: string
  files: UploadFile[]
  name: string
  phone: string
  email: string
  contactMethod: ContactMethod
  preferredTime: string
  consent: boolean
}
export interface PriceEstimate {
  amount: number | null
  approximate: boolean
  requiresManualQuote: boolean
  manualServices: string[]
  pricedServices: Array<ServicePrice & { id: string; name: string }>
}
