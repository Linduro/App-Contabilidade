import type { Metadata } from "next"
import { TRPCProvider } from "@/lib/trpc-provider"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css"
import "./rede-teste-theme.css"

export const metadata: Metadata = {
  title: "Rede Teste",
  description: "Rede social de teste — FIPECAFI Portal",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="rt-portal-theme rt-dark min-h-screen bg-[var(--rt-bg,#0f1419)] text-[var(--rt-text,#e7e9ea)] antialiased">
        <TRPCProvider>
          {children}
          <Toaster position="bottom-right" />
        </TRPCProvider>
      </body>
    </html>
  )
}
