import { assetPath } from "@/lib/base-path"

export type RestrictedAppCategory = "judiciais" | "avaliatorios" | "marketing"
export type RestrictedAppIconId =
  | "scale"
  | "sprout"
  | "landmark"
  | "briefcase"
  | "building"
  | "search"

export interface RestrictedApp {
  id: string
  title: string
  description: string
  href: string
  iconId: RestrictedAppIconId
  category: RestrictedAppCategory
  external?: boolean
}

export const RESTRICTED_APP_CATEGORIES: {
  id: RestrictedAppCategory
  title: string
  description: string
}[] = [
  {
    id: "judiciais",
    title: "Assuntos judiciais",
    description: "Prospecção, monitoramento e leads em contencioso e execuções.",
  },
  {
    id: "avaliatorios",
    title: "Assuntos avaliatórios",
    description: "Ferramentas de avaliação patrimonial e precificação de ativos.",
  },
  {
    id: "marketing",
    title: "Assuntos de marketing",
    description: "Inteligência comercial e prospecção B2B.",
  },
]

export const RESTRICTED_APPS: RestrictedApp[] = [
  {
    id: "licitacoes",
    title: "Licitações",
    description: "Monitoramento e classificação de editais jurídicos.",
    href: "/dashboard/licitacoes/",
    iconId: "scale",
    category: "judiciais",
  },
  {
    id: "execucoes-rurais",
    title: "Execuções rurais",
    description: "Coleta e análise de execuções em área rural.",
    href: "/dashboard/execucoes-rurais/",
    iconId: "sprout",
    category: "judiciais",
  },
  {
    id: "execucoes-alto-valor",
    title: "Execuções +500k",
    description: "Execuções acima de R$ 500 mil no DataJud.",
    href: "/dashboard/execucoes-alto-valor/",
    iconId: "landmark",
    category: "judiciais",
  },
  {
    id: "trabalhista-leads",
    title: "Leads TRT",
    description: "Kanban de leads trabalhistas por região.",
    href: "/dashboard/trabalhista-leads/",
    iconId: "briefcase",
    category: "judiciais",
  },
  {
    id: "afs-valuation",
    title: "AFS Valuation",
    description: "Avaliação patrimonial com apoio de IA.",
    href: assetPath("/afs-valuation/index.html"),
    iconId: "building",
    category: "avaliatorios",
    external: true,
  },
  {
    id: "afs-market-intelligence",
    title: "AFS Intelligence",
    description: "Prospecção B2B e inteligência de mercado.",
    href: "/dashboard/afs-market-intelligence/",
    iconId: "search",
    category: "marketing",
  },
]

export function appsByCategory(category: RestrictedAppCategory) {
  return RESTRICTED_APPS.filter((app) => app.category === category)
}
