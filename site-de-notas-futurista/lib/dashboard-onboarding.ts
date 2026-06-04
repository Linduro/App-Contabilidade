export interface OnboardingStep {
  id: string
  title: string
  description: string
}

/** Ordem segue o layout da página: topo do cabeçalho → atalhos → conteúdo principal. */
export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "contact",
    title: "Dúvidas ou contato?",
    description:
      "No topo à direita: WhatsApp e Instagram. Logo abaixo, reveja este tour ou alterne o tema. O botão Sair fica no canto inferior direito do cabeçalho.",
  },
  {
    id: "portal-links",
    title: "Atalhos do portal",
    description:
      "Links rápidos para o Blackboard, solicitações financeiras, biblioteca e PDFs oficiais da faculdade.",
  },
  {
    id: "video-tutorials",
    title: "Tutoriais em vídeo",
    description:
      "Vídeos passo a passo sobre pagamentos, serviços diversos e declaração de matrícula. Clique para assistir.",
  },
  {
    id: "hp12c",
    title: "Calculadora HP-12C",
    description:
      "Barra expansível abaixo dos atalhos do portal. Abra para usar o emulador completo em tamanho compacto — ideal para matemática financeira.",
  },
  {
    id: "search",
    title: "Busca rápida",
    description: "Encontre disciplinas, semestres ou notas digitando palavras-chave.",
  },
  {
    id: "legend",
    title: "Prioridades das disciplinas",
    description:
      "Essenciais (🔥🔥), importantes (🔥), neutras (⚪) e dispensadas (🚫). Clique no emoji de cada disciplina para mudar a categoria.",
  },
  {
    id: "semesters",
    title: "Seus semestres",
    description:
      "A grade já vem com 8 semestres e 40 disciplinas. Clique no título tracejado para renomear, edite notas, marque Cursando/Concluído e arraste ☰ para reordenar.",
  },
  {
    id: "add-semester",
    title: "Adicionar semestre",
    description: "Use este botão se precisar criar um bloco extra além da grade padrão.",
  },
  {
    id: "reminders",
    title: "Lembretes e prazos",
    description: "Anote provas, entregas e datas importantes para não perder nenhum prazo.",
  },
  {
    id: "notes",
    title: "Anotações gerais",
    description: "Espaço livre para observações, metas ou qualquer lembrete pessoal.",
  },
  {
    id: "dr-pitoco",
    title: "Dr Pitoco",
    description: "Dr Pitoco",
  },
]

export const HEADER_TOUR_STEP_IDS = new Set(["contact", "portal-links", "video-tutorials", "hp12c"])
export const FOOTER_TOUR_STEP_IDS = new Set(["dr-pitoco"])

export function onboardingStorageKey(userId: string) {
  return `advforte-onboarding-done-${userId}`
}

export function isOnboardingDone(userId: string) {
  if (typeof window === "undefined") return true
  return localStorage.getItem(onboardingStorageKey(userId)) === "1"
}

export function markOnboardingDone(userId: string) {
  localStorage.setItem(onboardingStorageKey(userId), "1")
}

export function clearOnboardingDone(userId: string) {
  localStorage.removeItem(onboardingStorageKey(userId))
}

export function scrollToTourStep(stepId: string) {
  if (stepId === "contact") {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  window.setTimeout(() => {
    document.querySelector(`[data-tour="${stepId}"]`)?.scrollIntoView({
      behavior: "smooth",
      block: FOOTER_TOUR_STEP_IDS.has(stepId)
        ? "end"
        : HEADER_TOUR_STEP_IDS.has(stepId)
          ? "start"
          : "center",
    })
  }, stepId === "contact" ? 120 : 0)
}
