import { AuthForm } from "@/components/auth-form"
import { AuthPageLayout } from "@/components/auth-page-layout"
import { GuestOnly } from "@/components/guest-only"
import Link from "next/link"

export default function SignUpPage() {
  return (
    <GuestOnly>
      <AuthPageLayout
        title="Crie sua conta"
        subtitle="Organize suas disciplinas, notas e prioridades estratégicas"
        footer="Feito de aluno para aluno — esta não é uma página oficial da faculdade."
      >
        <AuthForm mode="sign-up" />

        <div className="mt-6 text-center">
          <p className="text-muted-foreground">
            Já tem uma conta?{" "}
            <Link href="/sign-in" className="text-primary hover:text-primary/80 font-medium transition-colors">
              Entrar
            </Link>
          </p>
        </div>
      </AuthPageLayout>
    </GuestOnly>
  )
}
