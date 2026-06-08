import { Briefcase, FileText, Scale } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { Badge } from "@/components/ui/badge"
import { getNivelLabel } from "@/lib/licitacoes/formatters"
import type { AdvogadoEspecialidade, DashboardStats } from "@/lib/licitacoes/types"
import { RegionalFilterPanel } from "@/components/regional-filters/RegionalFilterPanel"
import type { RegionalFilterState } from "@/lib/regional-filters/regioes"

interface SidebarProps {
  especialidades: AdvogadoEspecialidade[]
  stats: DashboardStats
  advogadoOverride?: { nome: string; email: string }
  regionalFilters: RegionalFilterState
  onRegionalFiltersChange: (filters: RegionalFilterState) => void
}

export function Sidebar({
  especialidades,
  stats,
  advogadoOverride,
  regionalFilters,
  onRegionalFiltersChange,
}: SidebarProps) {
  const { user } = useAuth()
  const nome = advogadoOverride?.nome ?? user?.displayName ?? "Advogado"
  const email = advogadoOverride?.email ?? user?.email ?? ""

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r bg-card">
      <div className="border-b p-6">
        <div className="flex items-center gap-2">
          <Scale className="h-5 w-5" />
          <span className="font-semibold">Licitações Advocacia</span>
        </div>
        <p className="mt-4 text-sm font-medium">{nome}</p>
        <p className="text-xs text-muted-foreground">{email}</p>
      </div>

      <div className="flex-1 space-y-6 p-6">
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Especialidades
          </h2>
          {especialidades.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma especialidade cadastrada.
            </p>
          ) : (
            <ul className="space-y-2">
              {especialidades.map((item) => (
                <li
                  key={item.especialidade_id}
                  className="rounded-lg border bg-background px-3 py-2"
                >
                  <p className="text-sm font-medium">
                    {item.especialidade.nome}
                  </p>
                  <Badge variant="secondary" className="mt-1">
                    {getNivelLabel(item.nivel_experiencia)}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3">
          <div className="rounded-lg border bg-background p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span className="text-xs uppercase tracking-wide">
                Abertas este mês
              </span>
            </div>
            <p className="mt-2 text-2xl font-bold">{stats.abertasMes}</p>
          </div>

          <div className="rounded-lg border bg-background p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Briefcase className="h-4 w-4" />
              <span className="text-xs uppercase tracking-wide">
                Inscrições este mês
              </span>
            </div>
            <p className="mt-2 text-2xl font-bold">{stats.inscricoesMes}</p>
          </div>
        </section>

        <RegionalFilterPanel
          filters={regionalFilters}
          onChange={onRegionalFiltersChange}
        />
      </div>
    </aside>
  )
}
