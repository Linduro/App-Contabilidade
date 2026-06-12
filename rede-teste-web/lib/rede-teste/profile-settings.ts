export type RedeTesteProfileSettings = {
  assistantUrl?: string | null;
  assistantNotebookName?: string | null;
};

export function parseJqProfileSettings(raw: unknown): RedeTesteProfileSettings {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  return {
    assistantUrl:
      typeof o.assistantUrl === "string" ? o.assistantUrl : undefined,
    assistantNotebookName:
      typeof o.assistantNotebookName === "string"
        ? o.assistantNotebookName
        : undefined,
  };
}

export function mergeJqProfileSettings(
  current: unknown,
  patch: RedeTesteProfileSettings,
): RedeTesteProfileSettings {
  return { ...parseJqProfileSettings(current), ...patch };
}
