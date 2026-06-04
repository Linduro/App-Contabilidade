import Link from "next/link"
import { Sparkles, BookOpen, Bell, Calendar, ArrowRight, GraduationCap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AUTH_FOOTER_NOTE, SITE_FOOTER_NOTE } from "@/lib/site-copy"

export default function HomePage() {
  return (
    <main className="min-h-screen grid-pattern relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-accent/5 rounded-full blur-3xl" />
      </div>

      <header className="relative z-10 border-b border-border/50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold gradient-text">AdvForte Portal</span>
          </Link>

          <div className="flex items-center gap-4">
            <Link href="/sign-in">
              <Button variant="ghost" className="text-foreground/80 hover:text-foreground">
                Entrar
              </Button>
            </Link>
            <Link href="/sign-up">
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                Criar Conta
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="relative z-10 max-w-7xl mx-auto px-6 py-24 md:py-32">
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card-gold neon-border-gold mb-8">
            <GraduationCap className="w-4 h-4 text-accent" />
            <span className="text-sm text-accent font-medium">{AUTH_FOOTER_NOTE}</span>
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-foreground mb-6 leading-tight text-balance">
            Organize suas notas, prazos e{" "}
            <span className="gradient-text glow-text">prioridades</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed text-pretty">
            Ferramenta independente para quem estuda contabilidade — grade, médias, lembretes e
            links úteis em um só lugar. Não é página oficial da faculdade.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/sign-up">
              <Button
                size="lg"
                className="bg-primary hover:bg-primary/90 text-primary-foreground h-14 px-8 text-lg font-semibold neon-border animate-glow"
              >
                Criar conta
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <Link href="/sign-in">
              <Button
                size="lg"
                variant="outline"
                className="h-14 px-8 text-lg border-border hover:bg-secondary text-foreground"
              >
                Já tenho conta
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="relative z-10 max-w-7xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            O que você encontra aqui
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Pensado na rotina real do curso — sem complicação
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="glass-card rounded-2xl p-8 neon-border group hover:scale-[1.02] transition-transform duration-300">
            <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
              <BookOpen className="w-7 h-7 text-primary" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-3">Notas por disciplina</h3>
            <p className="text-muted-foreground leading-relaxed">
              Lance testes, avaliação intermediária e prova final com o peso certo. Acompanhe a média
              de cada matéria e do semestre.
            </p>
          </div>

          <div className="glass-card-gold rounded-2xl p-8 neon-border-gold group hover:scale-[1.02] transition-transform duration-300">
            <div className="w-14 h-14 rounded-xl bg-accent/10 flex items-center justify-center mb-6 group-hover:bg-accent/20 transition-colors">
              <Bell className="w-7 h-7 text-accent" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-3">Lembretes e prazos</h3>
            <p className="text-muted-foreground leading-relaxed">
              Registre provas, entregas e datas importantes. Ative avisos por e-mail para não
              perder nenhum prazo.
            </p>
          </div>

          <div className="glass-card rounded-2xl p-8 neon-border group hover:scale-[1.02] transition-transform duration-300">
            <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
              <Calendar className="w-7 h-7 text-primary" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-3">Grade e organização</h3>
            <p className="text-muted-foreground leading-relaxed">
              Semestres recolhíveis, disciplinas essenciais marcadas e atalhos para portais e
              tutoriais do dia a dia.
            </p>
          </div>
        </div>
      </section>

      <section className="relative z-10 max-w-7xl mx-auto px-6 py-24">
        <div className="glass-card rounded-3xl p-12 md:p-16 text-center neon-border relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-accent/5" />
          <div className="relative z-10">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4 text-balance">
              Comece a organizar seu semestre
            </h2>
            <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
              Conta gratuita, dados salvos na nuvem e pronta para usar em poucos minutos.
            </p>
            <Link href="/sign-up">
              <Button
                size="lg"
                className="bg-accent hover:bg-accent/90 text-accent-foreground h-14 px-10 text-lg font-semibold neon-border-gold"
              >
                Criar conta
                <Sparkles className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-border/50 py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-semibold text-foreground block">{AUTH_FOOTER_NOTE}</span>
              <span className="text-xs text-muted-foreground">{SITE_FOOTER_NOTE}</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} AdvForte Portal
          </p>
        </div>
      </footer>
    </main>
  )
}
