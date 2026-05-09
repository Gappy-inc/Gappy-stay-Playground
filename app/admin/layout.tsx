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
