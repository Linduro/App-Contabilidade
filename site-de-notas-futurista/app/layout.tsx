import { Analytics } from '@vercel/analytics/next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import type { Metadata, Viewport } from 'next'
import { AuthProvider } from '@/components/auth-provider'
import { ThemeProvider } from '@/components/theme-provider'
import { ThemeSync } from '@/components/theme-sync'
import { FirebaseAnalytics } from '@/components/firebase-analytics'
import { FloatingRadioPlayer } from '@/components/floating-radio-player'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains' })

const siteBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ''
const faviconHref = `${siteBasePath}/icon.svg`
const isGithubPages = process.env.NEXT_PUBLIC_GITHUB_PAGES === 'true'

export const metadata: Metadata = {
  title: 'AdvForte Portal | Notas e organização acadêmica',
  description:
    'Ferramenta feita de aluno para aluno: grade, notas, lembretes e links úteis para o curso de contabilidade. Não é página oficial da faculdade.',
  generator: 'v0.app',
}

export const viewport: Viewport = {
  themeColor: '#f8f7f4',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={`${inter.variable} ${jetbrainsMono.variable} bg-background`}>
      <head>
        <link rel="icon" href={faviconHref} type="image/svg+xml" />
        <link rel="apple-touch-icon" href={faviconHref} />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var uid=localStorage.getItem('advforte-theme-last-uid');var t=uid?localStorage.getItem('advforte-theme-'+uid):null;t=t||localStorage.getItem('advforte-theme')||localStorage.getItem('nexus-theme');if(t==='dark')document.documentElement.classList.add('dark');}catch(e){}})();`,
          }}
        />
      </head>
      <body className="font-sans antialiased min-h-screen">
        <ThemeProvider>
          <AuthProvider>
            <ThemeSync />
            {children}
            <FloatingRadioPlayer />
          </AuthProvider>
        </ThemeProvider>
        <FirebaseAnalytics />
        {!isGithubPages && process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
