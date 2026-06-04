export interface AuthUser {
  id: string
  email: string
  nome: string
  profileId: string | null
}

export interface AuthResponse {
  token: string
  user: AuthUser
}

export interface Profile {
  id: string
  userId?: string
  nome: string
  turma: string | null
  cargoAtual: string | null
  empresa: string | null
  areaAtuacao: string[]
  expertises: string[]
  oQueOfeco: string | null
  oQueBusco: string | null
  linkedinUrl: string | null
  disponivelMentoria: boolean
  bio: string | null
  avatarUrl: string | null
  embeddingGeradoEm?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface MatchBreakdown {
  semantic: number
  tagsShared: number
  complementarity: number
}

export interface MatchSuggestion {
  profile: Profile
  score: number
  distance: number
  breakdown: MatchBreakdown
}

export interface GraphNode {
  id: string
  type: "expertise" | "profile"
  label: string
  size?: number
  turma?: string
}

export interface GraphEdge {
  source: string
  target: string
  weight: number
}

export interface ExpertiseWebGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export type ConnectionStatus = "pendente" | "aceita" | "ignorada"

export interface ConnectionItem {
  id: string
  status: ConnectionStatus
  similarityScore: number
  createdAt: string
  direction: "sent" | "received"
  otherProfile: Profile
}

export interface PendingConnectionsResponse {
  connections: ConnectionItem[]
  count: number
}
