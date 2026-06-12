"use client";

import { Briefcase, Calendar, ExternalLink, MapPin, Scale } from "lucide-react";
import { formatJqHandle } from "@/lib/rede-teste/format";
import {
  JQ_PROFESSIONAL_KIND_LABELS,
  type JqProfessionalKind,
} from "@/lib/rede-teste/profile/professional-kind";
import { useJqProfile } from "./profile-context";

function prettyUrl(url: string) {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function ProfileMetadataRow() {
  const p = useJqProfile();
  const oabLabel =
    p.oabNumber && p.oabUf ? `OAB/${p.oabUf} ${p.oabNumber}` : null;
  const joinedLabel = p.createdAt
    ? new Date(p.createdAt).toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
      })
    : null;
  const kindLabel = p.professionalKind
    ? JQ_PROFESSIONAL_KIND_LABELS[p.professionalKind as JqProfessionalKind]
    : null;

  const items: { icon: typeof MapPin; node: React.ReactNode }[] = [];

  if (p.location) {
    items.push({ icon: MapPin, node: p.location });
  }
  if (p.website) {
    items.push({
      icon: ExternalLink,
      node: (
        <a
          href={p.website}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--jq-reply)] hover:underline"
        >
          {prettyUrl(p.website)}
        </a>
      ),
    });
  }
  if (p.lawFirm) {
    items.push({ icon: Briefcase, node: p.lawFirm });
  }
  if (oabLabel) {
    items.push({ icon: Scale, node: oabLabel });
  }
  if (kindLabel) {
    items.push({ icon: Briefcase, node: kindLabel });
  }
  if (joinedLabel) {
    items.push({ icon: Calendar, node: `Entrou em ${joinedLabel}` });
  }

  if (items.length === 0 && !p.bio && p.practiceAreas.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 px-4">
      <p className="text-[var(--jq-muted)]">{formatJqHandle(p.handle)}</p>
      {p.bio ? <p className="text-sm leading-relaxed">{p.bio}</p> : null}
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-[var(--jq-muted)]">
          {items.map((item, i) => (
            <span key={i} className="inline-flex items-center gap-1">
              <item.icon className="size-3.5 shrink-0" aria-hidden />
              {item.node}
            </span>
          ))}
        </div>
      ) : null}
      {p.practiceAreas.length > 0 ? (
        <p className="text-sm text-[var(--jq-muted)]">{p.practiceAreas.join(" · ")}</p>
      ) : null}
      {p.workspaceName && !p.isSelf ? (
        <p className="text-sm text-[var(--jq-muted)]">Escritório Portal: {p.workspaceName}</p>
      ) : null}
    </div>
  );
}
