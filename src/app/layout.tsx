import type { Metadata } from 'next'
import { Playfair_Display, Noto_Sans } from 'next/font/google'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { AuthSessionProvider } from '@/components/providers/session-provider'
import { Toaster } from 'sonner'
import './globals.css'

const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-playfair',
  display: 'swap',
})

const notoSans = Noto_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-noto-sans',
  display: 'swap',
})


export const metadata: Metadata = {
  title: 'Dolata & Co — Billing',
  description: 'Legal billing system for Dolata & Co Attorneys',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${playfairDisplay.variable} ${notoSans.variable} font-sans antialiased`}
      >
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <AuthSessionProvider>
            {children}
            <Toaster richColors position="top-right" />
          </AuthSessionProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
