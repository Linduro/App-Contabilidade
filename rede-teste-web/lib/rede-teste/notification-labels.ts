export const jqNotificationTypeLabel: Record<string, string> = {
  LIKE: "curtiu sua publicação",
  REPLY: "comentou sua publicação",
  MENTION: "mencionou você",
  FOLLOW: "começou a seguir você",
  REPOST: "republicou sua publicação",
  FOLLOW_REQUEST: "solicitou seguir você",
  POLL_ENDING: "sua enquete encerra em breve",
  SCHEDULED_PUBLISHED: "sua publicação agendada foi publicada",
  COMMUNITY_INVITE: "convidou você para uma comunidade",
  SYSTEM: "novidade da plataforma",
};

export function jqNotificationActionLabel(type: string, totalActors: number): string {
  const base = jqNotificationTypeLabel[type] ?? type.toLowerCase();
  if (totalActors > 1 && type === "LIKE") return "curtiram sua publicação";
  if (totalActors > 1 && type === "FOLLOW") return "começaram a seguir você";
  return base;
}
