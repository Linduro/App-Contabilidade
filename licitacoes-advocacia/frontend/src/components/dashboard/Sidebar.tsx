import { Briefcase, FileText, LogOut, Scale } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getNivelLabel } from "@/lib/formatters";
import type { AdvogadoEspecialidade, DashboardStats } from "@/types";

interface SidebarProps {
  especialidades: AdvogadoEspecialidade[];
  stats: DashboardStats;
}

export function Sidebar({ especialidades, stats }: SidebarProps) {
  const { advogado, signOut } = useAuth();

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r bg-card">
      <div className="border-b p-6">
        <div className="flex items-center gap-2">
          <Scale className="h-5 w-5" />
          <span className="font-semibold">Licitações Advocacia</span>
        </div>
        <p className="mt-4 text-sm font-medium">{advogado?.nome}</p>
        <p className="text-xs text-muted-foreground">{advogado?.email}</p>
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
      </div>

      <div className="border-t p-4">
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={() => signOut()}
        >
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    </aside>
  );
}
