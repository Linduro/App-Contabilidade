"use client"

import Link from "next/link"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import { AUTH_FOOTER_NOTE } from "@/lib/site-copy"

interface AuthPageLayoutProps {
  title: string
  subtitle: string
  children: React.ReactNode
}

export function AuthPageLayout({ title, subtitle, children }: AuthPageLayoutProps) {
  const { theme, toggleTheme } = useTheme()

  return (
    <main className="min-h-screen grid-pattern relative overflow-hidden flex flex-col">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-accent/5 rounded-full blur-3xl" />
      </div>

      <header className="relative z-10 border-b border-border/50 glass-card">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="text-sm font-bold text-primary hover:text-primary/80 transition-colors"
          >
            Gestão de Progressão
          </Link>

          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            className="text-muted-foreground shrink-0"
            title={theme === "light" ? "Modo escuro" : "Modo claro"}
          >
            {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </Button>
        </div>
      </header>

      <div className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold gradient-text mb-2">{title}</h1>
            <p className="text-muted-foreground">{subtitle}</p>
          </div>

          <div className="glass-card rounded-2xl p-8 neon-border">{children}</div>
        </div>
      </div>

      <footer className="relative z-10 py-8 px-6 text-center">
        <p className="text-sm text-muted-foreground/80 italic">{AUTH_FOOTER_NOTE}</p>
      </footer>
    </main>
  )
}
