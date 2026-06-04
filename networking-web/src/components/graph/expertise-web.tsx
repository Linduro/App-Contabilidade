"use client"

import { useEffect, useRef, useState } from "react"
import * as d3 from "d3"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { GraphNode, Profile } from "@/types/api"
import { Card, CardContent } from "@/components/ui/card"
import { ExpertiseTag } from "@/components/profile/expertise-tag"
import Link from "next/link"
import { Button } from "@/components/ui/button"

interface SimNode extends d3.SimulationNodeDatum {
  id: string
  type: "expertise" | "profile"
  label: string
  size: number
  turma?: string
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  source: string | SimNode
  target: string | SimNode
  weight: number
}

export function ExpertiseWeb() {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(
    null
  )

  const { data, isLoading, isError } = useQuery({
    queryKey: ["expertise-web"],
    queryFn: () => api.getExpertiseWeb(),
  })

  useEffect(() => {
    if (!data || !containerRef.current) return

    const width = containerRef.current.clientWidth
    const height = Math.max(400, containerRef.current.clientHeight || 500)

    d3.select(containerRef.current).selectAll("svg").remove()

    const svg = d3
      .select(containerRef.current)
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`)

    const g = svg.append("g")

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on("zoom", (event) => {
        g.attr("transform", event.transform.toString())
      })

    svg.call(zoom)
    svgRef.current = svg.node()

    const nodes: SimNode[] = data.nodes.map((n: GraphNode) => ({
      id: n.id,
      type: n.type,
      label: n.label,
      size: n.type === "expertise" ? Math.max(12, (n.size ?? 1) * 4) : 10,
      turma: n.turma,
    }))

    const nodeById = new Map(nodes.map((n) => [n.id, n]))

    const links: SimLink[] = data.edges
      .map((e) => ({
        source: nodeById.get(e.source) ?? e.source,
        target: nodeById.get(e.target) ?? e.target,
        weight: e.weight,
      }))
      .filter((l) => l.source && l.target) as SimLink[]

    const simulation = d3
      .forceSimulation(nodes)
      .force(
        "link",
        d3.forceLink<SimNode, SimLink>(links).id((d) => d.id).distance(80)
      )
      .force("charge", d3.forceManyBody().strength(-220))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide<SimNode>().radius((d) => d.size + 4))

    const link = g
      .append("g")
      .attr("stroke", "#94a3b8")
      .attr("stroke-opacity", 0.4)
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", 1.5)

    const node = g
      .append("g")
      .selectAll("circle")
      .data(nodes)
      .join("circle")
      .attr("r", (d) => d.size)
      .attr("fill", (d) => (d.type === "expertise" ? "#818cf8" : "#34d399"))
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .style("cursor", "pointer")
      .on("mouseover", function (event, d) {
        d3.select(this).attr("stroke-width", 3)
        const [x, y] = d3.pointer(event, containerRef.current)
        setTooltip({ x, y, text: d.label })
        if (d.type === "expertise") {
          const connected = new Set(
            links
              .filter((l) => {
                const sid = typeof l.source === "object" ? l.source.id : l.source
                const tid = typeof l.target === "object" ? l.target.id : l.target
                return sid === d.id || tid === d.id
              })
              .flatMap((l) => {
                const sid = typeof l.source === "object" ? l.source.id : l.source
                const tid = typeof l.target === "object" ? l.target.id : l.target
                return [sid, tid]
              })
          )
          node.attr("opacity", (n) =>
            n.type === "profile" && connected.has(n.id) ? 1 : 0.25
          )
          link.attr("stroke-opacity", (l) => {
            const sid = typeof l.source === "object" ? l.source.id : l.source
            const tid = typeof l.target === "object" ? l.target.id : l.target
            return sid === d.id || tid === d.id ? 0.8 : 0.1
          })
        }
      })
      .on("mouseout", function () {
        d3.select(this).attr("stroke-width", 1.5)
        setTooltip(null)
        node.attr("opacity", 1)
        link.attr("stroke-opacity", 0.4)
      })
      .on("click", async (_, d) => {
        if (d.type !== "profile") return
        const profileId = d.id.replace("profile:", "")
        try {
          const res = await api.getProfile(profileId)
          setSelectedProfile(res.profile)
        } catch {
          setSelectedProfile(null)
        }
      })

    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as SimNode).x ?? 0)
        .attr("y1", (d) => (d.source as SimNode).y ?? 0)
        .attr("x2", (d) => (d.target as SimNode).x ?? 0)
        .attr("y2", (d) => (d.target as SimNode).y ?? 0)

      node.attr("cx", (d) => d.x ?? 0).attr("cy", (d) => d.y ?? 0)
    })

    const handleResize = () => {
      if (!containerRef.current) return
      const w = containerRef.current.clientWidth
      const h = Math.max(400, containerRef.current.clientHeight || 500)
      svg.attr("width", w).attr("height", h)
      simulation.force("center", d3.forceCenter(w / 2, h / 2))
      simulation.alpha(0.3).restart()
    }

    window.addEventListener("resize", handleResize)
    return () => {
      window.removeEventListener("resize", handleResize)
      simulation.stop()
    }
  }, [data])

  if (isLoading) {
    return (
      <div className="h-full min-h-[400px] flex items-center justify-center text-slate-500">
        Carregando teia...
      </div>
    )
  }

  if (isError) {
    return (
      <div className="h-full min-h-[400px] flex items-center justify-center text-red-500">
        Não foi possível carregar o grafo.
      </div>
    )
  }

  return (
    <div className="relative h-full min-h-[400px] rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
      <div ref={containerRef} className="w-full h-full min-h-[400px]" />
      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 rounded-md bg-slate-900 text-white text-xs px-2 py-1"
          style={{ left: tooltip.x + 8, top: tooltip.y + 8 }}
        >
          {tooltip.text}
        </div>
      )}
      {selectedProfile && (
        <Card className="absolute top-3 right-3 w-64 z-20 shadow-lg">
          <CardContent className="pt-4 space-y-2">
            <p className="font-semibold">{selectedProfile.nome}</p>
            <p className="text-xs text-slate-500">
              {selectedProfile.cargoAtual} · {selectedProfile.empresa}
            </p>
            <div className="flex flex-wrap gap-1">
              {selectedProfile.expertises.slice(0, 5).map((t) => (
                <ExpertiseTag key={t} label={t} />
              ))}
            </div>
            <Link href={`/profile/${selectedProfile.id}`}>
              <Button size="sm" className="w-full">
                Abrir perfil
              </Button>
            </Link>
            <Button
              size="sm"
              variant="ghost"
              className="w-full"
              onClick={() => setSelectedProfile(null)}
            >
              Fechar
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
