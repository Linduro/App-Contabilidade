/**
 * Ponte portal ↔ Rede Teste (localStorage, sem publicação automática).
 */

const COMPOSER_KEY = (userId: string) => `rede-teste:composer:${userId}`;
const ESTAGIARIO_KEY = (userId: string) => `rede-teste:estagiario:${userId}`;

export type JqComposerPrefill = {
  content: string;
  attachmentLabel: string;
  hasPersonalData: boolean;
  sourceTemplateId?: string;
  createdAt: string;
};

export type JqEstagiarioContext = {
  documentText: string;
  templateId?: string;
  templateTitle?: string;
  createdAt: string;
};

export function saveJqComposerPrefill(userId: string, data: Omit<JqComposerPrefill, "createdAt">) {
  if (typeof window === "undefined") return;
  const payload: JqComposerPrefill = { ...data, createdAt: new Date().toISOString() };
  localStorage.setItem(COMPOSER_KEY(userId), JSON.stringify(payload));
}

export function loadJqComposerPrefill(userId: string): JqComposerPrefill | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(COMPOSER_KEY(userId));
    return raw ? (JSON.parse(raw) as JqComposerPrefill) : null;
  } catch {
    return null;
  }
}

export function clearJqComposerPrefill(userId: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(COMPOSER_KEY(userId));
}

export function saveJqEstagiarioContext(userId: string, data: Omit<JqEstagiarioContext, "createdAt">) {
  if (typeof window === "undefined") return;
  const payload: JqEstagiarioContext = { ...data, createdAt: new Date().toISOString() };
  localStorage.setItem(ESTAGIARIO_KEY(userId), JSON.stringify(payload));
}

export function loadJqEstagiarioContext(userId: string): JqEstagiarioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ESTAGIARIO_KEY(userId));
    return raw ? (JSON.parse(raw) as JqEstagiarioContext) : null;
  } catch {
    return null;
  }
}

export function clearJqEstagiarioContext(userId: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ESTAGIARIO_KEY(userId));
}
