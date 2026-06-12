"use client"

import Link from "next/link"
import { ArrowLeft, Briefcase, Building2, ExternalLink, Landmark, Scale, Search, Sprout } from "lucide-react"
import { RequireAuth } from "@/components/require-auth"
import { RequireOwner } from "@/components/require-owner"
import { Button } from "@/components/ui/button"
import {
  RESTRICTED_APP_CATEGORIES,
  appsByCategory,
  type RestrictedApp,
  type RestrictedAppIconId,
} from "@/lib/restricted-apps"

const RESTRICTED_APP_ICONS = {
  scale: Scale,
  sprout: Sprout,
  landmark: Landmark,
  briefcase: Briefcase,
  building: Building2,
  search: Search,
} satisfies Record<RestrictedAppIconId, typeof Scale>

function AppCard({ app }: { app: RestrictedApp }) {
  const Icon = RESTRICTED_APP_ICONS[app.iconId]
  const className =
    "glass-card rounded-xl p-3 neon-border group hover:scale-[1.01] transition-transform duration-200 flex flex-col h-full min-h-0"

  const inner = (
    <>
      <div className="flex items-start gap-2.5 mb-1.5">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <h3 className="text-sm font-semibold text-foreground leading-tight flex items-center gap-1.5 pt-0.5">
          {app.title}
          {app.external && <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0" />}
        </h3>
      </div>
      <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2 flex-1 pl-[2.625rem]">
        {app.description}
      </p>
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
    <main className="min-h-screen max-h-screen grid-pattern relative overflow-hidden flex flex-col">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-accent/5 rounded-full blur-3xl" />
      </div>

      <header className="relative z-10 border-b border-border/50 shrink-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-12 flex items-center justify-between gap-4">
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" asChild>
            <Link href="/dashboard/">
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
              Portal FIPECAFI
            </Link>
          </Button>
          <span className="text-xs font-medium text-muted-foreground hidden sm:inline">
            Gabriel & Vinícius
          </span>
        </div>
      </header>

      <div className="relative z-10 flex-1 min-h-0 max-w-6xl mx-auto px-4 sm:px-6 py-4 w-full flex flex-col">
        <div className="mb-4 shrink-0">
          <h1 className="text-2xl font-bold gradient-text mb-1">Área restrita</h1>
          <p className="text-xs text-muted-foreground max-w-2xl leading-snug">
            Aplicações pessoais — organizadas por assunto.
          </p>
        </div>

        <div className="flex-1 min-h-0 space-y-4 overflow-hidden">
          {RESTRICTED_APP_CATEGORIES.map((category) => {
            const apps = appsByCategory(category.id)
            if (apps.length === 0) return null

            return (
              <section key={category.id} className="shrink-0">
                <div className="mb-2 flex items-baseline gap-2">
                  <h2 className="text-sm font-bold text-foreground">{category.title}</h2>
                  <p className="text-[10px] text-muted-foreground hidden sm:inline truncate">
                    {category.description}
                  </p>
                </div>
                <div
                  className={`grid gap-2.5 ${
                    apps.length >= 4
                      ? "grid-cols-2 lg:grid-cols-4"
                      : apps.length === 2
                        ? "grid-cols-2 max-w-xl"
                        : "grid-cols-1 max-w-xs"
                  }`}
                >
                  {apps.map((app) => (
                    <AppCard key={app.id} app={app} />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      </div>
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
