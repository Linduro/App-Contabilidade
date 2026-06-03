import { AuthForm } from "@/components/auth-form"
import { AuthPageLayout } from "@/components/auth-page-layout"
import { GuestOnly } from "@/components/guest-only"
import Link from "next/link"

export default function SignInPage() {
  return (
    <GuestOnly>
      <AuthPageLayout
        title="Bem-vindo de volta"
        subtitle="Entre para acessar seu percurso acadêmico. A recuperação de senha é feita por SMS."
        footer="Feito de aluno para aluno — esta não é uma página oficial da faculdade."
      >
        <AuthForm mode="sign-in" />

        <div className="mt-6 text-center">
          <p className="text-muted-foreground">
            Ainda não tem uma conta?{" "}
            <Link href="/sign-up" className="text-primary hover:text-primary/80 font-medium transition-colors">
              Criar conta
            </Link>
          </p>
        </div>
      </AuthPageLayout>
    </GuestOnly>
  )
}
