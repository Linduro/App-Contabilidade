"use client";

import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc-client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useJqProfile } from "./profile-context";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const REASONS = [
  { value: "spam", label: "Spam" },
  { value: "harassment", label: "Assédio" },
  { value: "impersonation", label: "Falsidade ideológica / perfil falso" },
  { value: "oab_fraud", label: "Fraude de OAB" },
  { value: "other", label: "Outro" },
] as const;

export function ProfileReportDialog({ open, onOpenChange }: Props) {
  const profile = useJqProfile();
  const [reason, setReason] = useState<(typeof REASONS)[number]["value"]>("spam");
  const [details, setDetails] = useState("");

  const report = trpc.redeTeste.reportProfile.useMutation({
    onSuccess: () => {
      toast.success("Denúncia enviada. Obrigado.");
      onOpenChange(false);
      setDetails("");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Denunciar @{profile.handle}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="reason">Motivo</Label>
            <select
              id="reason"
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={reason}
              onChange={(e) =>
                setReason(e.target.value as (typeof REASONS)[number]["value"])
              }
            >
              {REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="details">Detalhes (opcional)</Label>
            <Textarea
              id="details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={500}
              rows={3}
            />
          </div>
          <Button
            className="w-full"
            variant="destructive"
            disabled={report.isPending}
            onClick={() =>
              report.mutate({
                userId: profile.userId,
                reason,
                details: details.trim() || undefined,
              })
            }
          >
            Enviar denúncia
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
