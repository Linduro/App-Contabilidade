import type { Metadata } from "next"
import localFont from "next/font/local"
import "./globals.css"
import { AppProviders } from "@/providers/app-providers"

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
})
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
})

const isPagesDeploy = process.env.GITHUB_PAGES === "true"

export const metadata: Metadata = {
  title: "FIPECAFI Network",
  description: "Networking inteligente para profissionais FIPECAFI",
  ...(isPagesDeploy
    ? { robots: { index: false, follow: false, nocache: true } }
    : {}),
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased font-sans text-slate-900`}
      >
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  )
}
