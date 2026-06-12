import Link from "next/link"
import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SiteAdSlot } from "@/components/site-ad-slot"
import { ProfilePortalHome } from "@/components/rede-teste-portal/profile-home"
import { AUTH_FOOTER_NOTE, SITE_FOOTER_NOTE } from "@/lib/site-copy"

export default function HomePage() {
  return (
    <main className="min-h-screen grid-pattern relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-accent/5 rounded-full blur-3xl" />
      </div>

      <header className="relative z-10 border-b border-border/50">
        <div className="max-w-7xl mx-auto px-6 max-md:px-4 max-md:h-auto max-md:py-3 h-20 flex max-md:flex-wrap max-md:gap-3 items-center justify-between">
          <Link href="/" className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold gradient-text">AdvForte Portal</span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-4 max-md:w-full max-md:justify-end">
            <Link href="/sign-in">
              <Button variant="ghost" className="text-foreground/80 hover:text-foreground max-md:min-h-11 max-md:px-4">
                Entrar
              </Button>
            </Link>
            <Link href="/sign-up">
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground max-md:min-h-11 max-md:px-4">
                Criar Conta
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="relative z-10 max-w-7xl mx-auto px-6 max-md:px-4 py-12 max-md:py-8 md:py-16">
        <ProfilePortalHome />
      </section>

      <section className="relative z-10 max-w-3xl mx-auto px-6 max-md:px-4 pb-8">
        <SiteAdSlot placement="home" />
      </section>

      <footer className="relative z-10 border-t border-border/50 py-8">
        <div className="max-w-7xl mx-auto px-6 max-md:px-4 flex flex-col md:flex-row items-center justify-between gap-4">
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
