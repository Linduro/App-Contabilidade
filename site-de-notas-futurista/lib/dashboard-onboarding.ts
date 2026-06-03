export interface OnboardingStep {
  id: string
  title: string
  description: string
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
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
    id: "contact",
    title: "Dúvidas e contato",
    description:
      "No topo do cabeçalho: WhatsApp e Instagram. Ao lado, alterne o tema claro/escuro ou saia da conta.",
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
      "Essenciais, importantes, neutras e dispensadas. Clique no emoji de cada disciplina para mudar a categoria.",
  },
  {
    id: "semesters",
    title: "Seus semestres",
    description:
      "Cada card agrupa disciplinas. Edite nomes, notas, status Cursando/Concluído e arraste para reordenar.",
  },
  {
    id: "add-semester",
    title: "Adicionar semestre",
    description: "Crie um novo bloco quando avançar para o próximo período letivo.",
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
]

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
