// TODO(T-15 §8): i18n deferred to post-MVP for admin pages. The admin UI
// is hotel-side and intentionally English-only for the launch scope;
// guest-facing i18n is the foundation, and the admin surface gets its
// own ticket when the hotel-side feature set firms up.
import { Syne } from 'next/font/google'

const syne = Syne({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-syne',
  display: 'swap',
})

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={syne.variable} style={{ minHeight: '100vh' }}>
      {children}
    </div>
  )
}
