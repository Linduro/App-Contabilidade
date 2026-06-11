"use client"

import Link from "next/link"
import { ArrowLeft, ExternalLink } from "lucide-react"
import { RequireAuth } from "@/components/require-auth"
import { RequireOwner } from "@/components/require-owner"
import { Button } from "@/components/ui/button"
import { SiteFooter } from "@/components/site-footer"
import {
  RESTRICTED_APP_CATEGORIES,
  appsByCategory,
  type RestrictedApp,
} from "@/lib/restricted-apps"

function AppCard({ app }: { app: RestrictedApp }) {
  const Icon = app.icon
  const className =
    "glass-card rounded-2xl p-6 neon-border group hover:scale-[1.02] transition-transform duration-300 flex flex-col h-full"

  const inner = (
    <>
      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
        <Icon className="w-6 h-6 text-primary" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
        {app.title}
        {app.external && <ExternalLink className="w-4 h-4 text-muted-foreground" />}
      </h3>
      <p className="text-sm text-muted-foreground leading-relaxed flex-1">{app.description}</p>
      <span className="mt-4 text-sm font-medium text-primary group-hover:underline">Abrir aplicação →</span>
    </>
  )

  if (app.external) {
    return (
      <a
        href={app.href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {inner}
      </a>
    )
  }

  return (
    <Link href={app.href} className={className}>
      {inner}
    </Link>
  )
}

function RestrictedAreaContent() {
  return (
    <main className="min-h-screen grid-pattern relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-accent/5 rounded-full blur-3xl" />
      </div>

      <header className="relative z-10 border-b border-border/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar ao portal FIPECAFI
            </Link>
          </Button>
          <span className="text-sm font-semibold text-muted-foreground hidden sm:inline">
            Uso pessoal — Gabriel & Vinícius
          </span>
        </div>
      </header>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-10">
          <h1 className="text-3xl md:text-4xl font-bold gradient-text mb-2">Área restrita</h1>
          <p className="text-muted-foreground max-w-2xl">
            Aplicações pessoais separadas do portal acadêmico da comunidade FIPECAFI.
            Organizadas por assunto para iniciar o trabalho com um clique.
          </p>
        </div>

        <div className="space-y-12">
          {RESTRICTED_APP_CATEGORIES.map((category) => {
            const apps = appsByCategory(category.id)
            if (apps.length === 0) return null

            return (
              <section key={category.id}>
                <div className="mb-6">
                  <h2 className="text-xl md:text-2xl font-bold text-foreground mb-1">
                    {category.title}
                  </h2>
                  <p className="text-sm text-muted-foreground">{category.description}</p>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {apps.map((app) => (
                    <AppCard key={app.id} app={app} />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      </div>

      <SiteFooter />
    </main>
  )
}

export default function RestrictedAreaPage() {
  return (
    <RequireAuth>
      <RequireOwner>
        <RestrictedAreaContent />
      </RequireOwner>
    </RequireAuth>
  )
}
