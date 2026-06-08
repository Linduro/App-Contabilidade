import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AdvogadoEspecialidade, MatchFilters } from "@/types";

interface MatchFiltersBarProps {
  filters: MatchFilters;
  onChange: (filters: MatchFilters) => void;
  especialidades: AdvogadoEspecialidade[];
}

export function MatchFiltersBar({
  filters,
  onChange,
  especialidades,
}: MatchFiltersBarProps) {
  return (
    <div className="grid gap-4 rounded-xl border bg-card p-4 md:grid-cols-4">
      <div className="space-y-2">
        <Label>Especialidade</Label>
        <Select
          value={filters.especialidadeId}
          onValueChange={(value) =>
            onChange({ ...filters, especialidadeId: value })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Todas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {especialidades.map((item) => (
              <SelectItem
                key={item.especialidade_id}
                value={item.especialidade_id}
              >
                {item.especialidade.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Valor mínimo (R$)</Label>
        <Input
          type="number"
          min={0}
          placeholder="0"
          value={filters.valorMin}
          onChange={(e) => onChange({ ...filters, valorMin: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label>Valor máximo (R$)</Label>
        <Input
          type="number"
          min={0}
          placeholder="Sem limite"
          value={filters.valorMax}
          onChange={(e) => onChange({ ...filters, valorMax: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label>Cidade</Label>
        <Input
          placeholder="Ex: Curitiba"
          value={filters.cidade}
          onChange={(e) => onChange({ ...filters, cidade: e.target.value })}
        />
      </div>
    </div>
  );
}
