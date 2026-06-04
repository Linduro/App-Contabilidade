import Link from "next/link"
import { Network } from "lucide-react"

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex flex-col items-center justify-center p-4">
      <div className="mb-8 flex items-center gap-2 text-indigo-700 font-semibold">
        <Network className="w-6 h-6" />
        FIPECAFI Network
      </div>
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-1 mb-6">{subtitle}</p>}
        {!subtitle && <div className="mb-6" />}
        {children}
      </div>
      <p className="mt-6 text-xs text-slate-400">
        <Link href="/login" className="hover:text-indigo-600">
          Entrar
        </Link>
        {" · "}
        <Link href="/register" className="hover:text-indigo-600">
          Criar conta
        </Link>
      </p>
    </div>
  )
}
