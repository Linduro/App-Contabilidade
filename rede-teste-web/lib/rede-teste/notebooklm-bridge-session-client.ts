/** ID de sessão da aba do Estagiário (PDFs temporários vinculados a esta janela). */
export function createassistantBridgeSessionId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

export function sendassistantBridgeHeartbeat(sessionId: string): void {
  void fetch("/api/rede-teste/assistant-pdf/heartbeat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ sessionId }),
  });
}

export function revokeassistantBridgeSession(
  sessionId: string,
  options?: { beacon?: boolean },
): void {
  if (!sessionId) return;
  const body = JSON.stringify({ sessionId });
  if (options?.beacon && typeof navigator.sendBeacon === "function") {
    navigator.sendBeacon(
      "/api/rede-teste/assistant-pdf/revoke",
      new Blob([body], { type: "application/json" }),
    );
    return;
  }
  void fetch("/api/rede-teste/assistant-pdf/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body,
    keepalive: true,
  });
}
