"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import Link from "next/link"
import { AuthShell } from "@/components/auth/auth-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api, ApiError } from "@/lib/api"
import { useAuthStore } from "@/store/auth-store"
import { registerSchema, type RegisterInput } from "@/types/schemas"

export default function RegisterPage() {
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  })

  const onSubmit = async (data: RegisterInput) => {
    setError(null)
    try {
      const res = await api.register(data)
      setAuth(res.token, res.user)
      router.push("/profile/setup")
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Falha no cadastro")
    }
  }

  return (
    <AuthShell title="Criar conta" subtitle="Junte-se à rede de profissionais FIPECAFI">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="nome">Nome</Label>
          <Input id="nome" {...register("nome")} />
          {errors.nome && <p className="text-xs text-red-600">{errors.nome.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" {...register("email")} />
          {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <Input id="password" type="password" {...register("password")} />
          {errors.password && (
            <p className="text-xs text-red-600">{errors.password.message}</p>
          )}
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Criando..." : "Cadastrar"}
        </Button>
        <p className="text-center text-sm text-slate-500">
          Já tem conta?{" "}
          <Link href="/login" className="text-indigo-600 hover:underline">
            Entrar
          </Link>
        </p>
      </form>
    </AuthShell>
  )
}
