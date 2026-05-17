import type { Metadata } from 'next'
import { DM_Sans, Noto_Sans_JP } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages, getTranslations } from 'next-intl/server'
import './globals.css'

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-dm-sans',
  display: 'swap',
})

const notoSansJP = Noto_Sans_JP({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-noto-jp',
  display: 'swap',
})

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta')
  return {
    title: t('title'),
    description: t('description'),
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Both come from lib/i18n/request.ts (next-intl/server). The active
  // locale is resolved by the proxy + request config chain; the messages
  // chunk shipped to the client is only the active locale's payload
  // (NFR-1: no cross-locale bundle bloat).
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <html lang={locale} className={`${dmSans.variable} ${notoSansJP.variable}`}>
      <body className="min-h-screen">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
