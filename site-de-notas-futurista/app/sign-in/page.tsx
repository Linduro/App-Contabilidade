import { AuthForm } from "@/components/auth-form"
import { GuestOnly } from "@/components/guest-only"
import Link from "next/link"
import { Sparkles } from "lucide-react"

export default function SignInPage() {
  return (
    <GuestOnly>
      <main className="min-h-screen flex items-center justify-center p-4 grid-pattern relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 -right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
        </div>

        <div className="w-full max-w-md relative z-10">
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center neon-border">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold gradient-text">NexusPortal</span>
            </Link>
            <h1 className="text-3xl font-bold text-foreground mb-2">Bem-vindo de volta</h1>
            <p className="text-muted-foreground">Entre para acessar suas notas e recados</p>
          </div>

          <div className="glass-card rounded-2xl p-8 neon-border">
            <AuthForm mode="sign-in" />

            <div className="mt-6 text-center">
              <p className="text-muted-foreground">
                Ainda não tem uma conta?{" "}
                <Link href="/sign-up" className="text-primary hover:text-primary/80 font-medium transition-colors">
                  Criar conta
                </Link>
              </p>
            </div>
          </div>

          <p className="text-center text-muted-foreground/60 text-sm mt-8">
            Protegido com criptografia de ponta a ponta
          </p>
        </div>
      </main>
    </GuestOnly>
  )
}
