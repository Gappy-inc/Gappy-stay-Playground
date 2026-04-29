export type Booking = {
  booking_id: string
  guest_name: string
  nationality: string
  phone: string
  email: string
  language: 'en' | 'ja' | 'ko' | 'zh'
  room_type: string
  room_number: string
  check_in: string
  check_out: string
  nights: number
  guests: number
  booking_source: string
  total_paid: number
  special_requests: string
  tags: string[]
}

export type OfferTemplate = {
  offer_id: string
  category: 'room' | 'dining' | 'wellness' | 'transport' | 'experience' | 'bundle'
  title: Record<string, string>
  description: Record<string, string>
  price: number
  original_price: number | null
  unit: string
  availability: number
  popularity: number
  tags: string[]
  applicable_to: string[]
  includes?: string[]
}

export type GeneratedOffer = {
  offer_id: string
  title: string
  description: string
  personalized_message: string
  price: number
  original_price: number | null
  unit: string
  availability: number
  popularity: number
  category: string
  badge?: string
  includes?: string[]
}

export type CartItem = {
  offer_id: string
  title: string
  price: number
  unit: string
  quantity: number
}

export type MessagingChannel = 'LINE' | 'WhatsApp' | 'SMS' | 'Email'

export type Order = {
  order_id: string
  booking_id: string
  guest_name: string
  room_type: string
  check_in: string
  items: CartItem[]
  total: number
  created_at: string
}

export type SurveyAnswers = {
  purpose: string
  morning: string
  interests: string[]
}
