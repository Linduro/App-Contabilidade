import { eq, ne } from "drizzle-orm"
import { db } from "../../db/index.js"
import { expertisesCatalog, profiles } from "../../db/schema.js"

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

function expertiseNodeId(nome: string): string {
  return `expertise:${nome}`
}

function profileNodeId(id: string): string {
  return `profile:${id}`
}

export async function getExpertiseWeb(): Promise<ExpertiseWebGraph> {
  const allProfiles = await db
    .select({
      id: profiles.id,
      nome: profiles.nome,
      turma: profiles.turma,
      expertises: profiles.expertises,
    })
    .from(profiles)

  const expertiseCounts = new Map<string, number>()
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []

  for (const profile of allProfiles) {
    nodes.push({
      id: profileNodeId(profile.id),
      type: "profile",
      label: profile.nome,
      turma: profile.turma ?? undefined,
    })

    for (const tag of profile.expertises) {
      const key = tag.trim()
      if (!key) continue

      expertiseCounts.set(key, (expertiseCounts.get(key) ?? 0) + 1)
      edges.push({
        source: profileNodeId(profile.id),
        target: expertiseNodeId(key),
        weight: 1,
      })
    }
  }

  for (const [nome, size] of expertiseCounts) {
    nodes.push({
      id: expertiseNodeId(nome),
      type: "expertise",
      label: nome,
      size,
    })
  }

  const catalog = await db.select().from(expertisesCatalog)
  for (const item of catalog) {
    const nodeId = expertiseNodeId(item.nome)
    if (!nodes.some((n) => n.id === nodeId)) {
      nodes.push({
        id: nodeId,
        type: "expertise",
        label: item.nome,
        size: 0,
      })
    }
  }

  return { nodes, edges }
}

export async function getProfileNetwork(profileId: string): Promise<ExpertiseWebGraph | null> {
  const center = await db.query.profiles.findFirst({
    where: eq(profiles.id, profileId),
  })

  if (!center) return null

  const sharedTags = center.expertises.filter(Boolean)
  const nodes: GraphNode[] = [
    {
      id: profileNodeId(center.id),
      type: "profile",
      label: center.nome,
      turma: center.turma ?? undefined,
    },
  ]
  const edges: GraphEdge[] = []
  const expertiseSet = new Set<string>()

  for (const tag of sharedTags) {
    expertiseSet.add(tag)
    edges.push({
      source: profileNodeId(center.id),
      target: expertiseNodeId(tag),
      weight: 1,
    })
    nodes.push({
      id: expertiseNodeId(tag),
      type: "expertise",
      label: tag,
      size: 1,
    })
  }

  if (sharedTags.length === 0) {
    return { nodes, edges }
  }

  const candidates = await db
    .select()
    .from(profiles)
    .where(ne(profiles.id, center.id))

  const others = candidates.filter((profile) =>
    profile.expertises.some((tag) => expertiseSet.has(tag))
  )

  for (const other of others) {
    const overlap = other.expertises.filter((t) => expertiseSet.has(t))
    if (overlap.length === 0) continue

    nodes.push({
      id: profileNodeId(other.id),
      type: "profile",
      label: other.nome,
      turma: other.turma ?? undefined,
    })

    for (const tag of overlap) {
      edges.push({
        source: profileNodeId(other.id),
        target: expertiseNodeId(tag),
        weight: 1,
      })

      const expertiseNode = nodes.find((n) => n.id === expertiseNodeId(tag))
      if (expertiseNode && expertiseNode.type === "expertise") {
        expertiseNode.size = (expertiseNode.size ?? 1) + 1
      }
    }
  }

  return { nodes, edges }
}
