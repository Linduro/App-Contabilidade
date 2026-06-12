"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { validateScheduledAt } from "@/lib/rede-teste/composer-validations";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (date: Date) => void;
};

export function ComposerScheduleDialog({ open, onOpenChange, onConfirm }: Props) {
  const defaultDate = new Date(Date.now() + 60 * 60 * 1000);
  const [dateStr, setDateStr] = useState(format(defaultDate, "yyyy-MM-dd"));
  const [timeStr, setTimeStr] = useState(format(defaultDate, "HH:mm"));
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    const scheduled = new Date(`${dateStr}T${timeStr}:00`);
    const err = validateScheduledAt(scheduled);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    onConfirm(scheduled);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-[var(--jq-border)] bg-[var(--jq-bg)] text-[var(--jq-text)]">
        <DialogHeader>
          <DialogTitle>Agendar publicação</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label htmlFor="jq-schedule-date">Data</Label>
            <Input
              id="jq-schedule-date"
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="border-[var(--jq-border)] bg-[var(--jq-surface)]"
            />
          </div>
          <div>
            <Label htmlFor="jq-schedule-time">Horário</Label>
            <Input
              id="jq-schedule-time"
              type="time"
              value={timeStr}
              onChange={(e) => setTimeStr(e.target.value)}
              className="border-[var(--jq-border)] bg-[var(--jq-surface)]"
            />
          </div>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            className="rounded-full bg-[var(--jq-primary)] text-white"
            onClick={handleConfirm}
          >
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function formatScheduledLabel(date: Date) {
  return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}
