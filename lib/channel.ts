import { MessagingChannel } from '@/types'

export function detectChannel(phone: string): MessagingChannel {
  if (phone.startsWith('+81')) return 'LINE'
  if (
    phone.startsWith('+1') ||
    phone.startsWith('+44') ||
    phone.startsWith('+61')
  )
    return 'WhatsApp'
  if (phone.startsWith('+82')) return 'SMS'
  return 'Email'
}
