"use client"

import Link from "next/link"
import { ArrowRight, BookOpen, Bell, Calendar, GraduationCap, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/components/auth-provider"

const TABS = [
  { id: "publicacoes", label: "Publicações", active: true },
  { id: "sobre", label: "Sobre" },
  { id: "rede", label: "Rede Teste" },
] as const

export function ProfilePortalHome() {
  const { user } = useAuth()
  const displayName = user?.displayName || user?.email?.split("@")[0] || "Estudante FIPECAFI"
  const handle = user?.email?.split("@")[0] || "estudante"

  return (
    <div className="max-w-3xl mx-auto">
      <div className="glass-card rounded-2xl overflow-hidden neon-border">
        <div className="h-32 bg-gradient-to-r from-[#1b2a4e] to-[#243656]" />
        <div className="px-6 pb-6">
          <div className="flex items-end justify-between -mt-12">
            <div className="w-24 h-24 rounded-full border-4 border-background bg-gradient-to-br from-primary to-accent flex items-center justify-center text-2xl font-bold text-white">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="flex gap-2 pb-1">
              <Link href="/sign-up">
                <Button size="sm" variant="outline">Criar conta</Button>
              </Link>
              <Link href="/dashboard/rede-teste/">
                <Button size="sm" className="bg-primary text-primary-foreground">
                  Rede Teste
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          </div>

          <div className="mt-4">
            <h1 className="text-2xl font-bold text-foreground">{displayName}</h1>
            <p className="text-muted-foreground">@{handle}</p>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              Portal acadêmico com rede social de teste para networking entre estudantes.
              Organize notas, prazos e conecte-se na <strong className="text-foreground">Rede Teste</strong>.
            </p>
          </div>

          <div className="mt-4 flex gap-6 text-sm">
            <span><strong className="text-foreground">0</strong> <span className="text-muted-foreground">publicações</span></span>
            <span><strong className="text-foreground">—</strong> <span className="text-muted-foreground">seguidores</span></span>
            <span><strong className="text-foreground">—</strong> <span className="text-muted-foreground">seguindo</span></span>
          </div>
        </div>

        <div className="border-t border-border/50 flex overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`flex-1 min-w-[100px] py-4 text-sm font-medium transition-colors ${
                tab.active
                  ? "text-foreground border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3 p-4 rounded-xl bg-secondary/40 border border-border/40">
            <Users className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-foreground">Rede Teste</p>
              <p className="text-sm text-muted-foreground mt-1">
                Rede social copiada do módulo Juridiquês, renomeada e sem dados do escritório.
                Feed, perfis, conexões e mensagens.
              </p>
              <Link href="/dashboard/rede-teste/" className="text-sm text-primary hover:underline mt-2 inline-block">
                Abrir Rede Teste →
              </Link>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            {[
              { icon: BookOpen, title: "Notas", desc: "Médias por disciplina" },
              { icon: Bell, title: "Lembretes", desc: "Prazos e provas" },
              { icon: Calendar, title: "Grade", desc: "Semestres organizados" },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="p-4 rounded-xl border border-border/40 bg-card/50">
                <Icon className="w-5 h-5 text-primary mb-2" />
                <p className="font-medium text-sm">{title}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card-gold neon-border-gold mb-4">
          <GraduationCap className="w-4 h-4 text-accent" />
          <span className="text-sm text-accent font-medium">FIPECAFI — ferramenta independente</span>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/sign-up">
            <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground h-12 px-8">
              Criar conta
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
          <Link href="/sign-in">
            <Button size="lg" variant="outline" className="h-12 px-8">
              Já tenho conta
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
