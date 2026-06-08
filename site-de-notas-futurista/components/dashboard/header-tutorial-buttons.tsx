"use client"

import { useState } from "react"
import { BookOpen, Calculator, ChevronDown, ExternalLink, PlayCircle } from "lucide-react"
import { Hp12cCalculatorPanel } from "@/components/dashboard/hp12c-calculator-panel"
import { MatematicaFinanceiraPanel } from "@/components/dashboard/matematica-financeira-panel"
import { getPortalHref, PORTAL_LINKS } from "@/lib/portal-links"
import { TUTORIAL_VIDEOS } from "@/lib/tutorial-videos"

const HP12C_PANEL_ID = "hp12c"
const MAT_FIN_PANEL_ID = "matematica-financeira"

export function HeaderTutorialButtons() {
  const [openId, setOpenId] = useState<string | null>(null)

  const toggle = (id: string) => {
    setOpenId((current) => (current === id ? null : id))
  }

  const openTutorial = TUTORIAL_VIDEOS.find((tutorial) => tutorial.id === openId)
  const hp12cOpen = openId === HP12C_PANEL_ID
  const matFinOpen = openId === MAT_FIN_PANEL_ID

  return (
    <div className="mt-3 w-full space-y-2">
      <div className="flex flex-col md:flex-row md:items-start gap-2 md:gap-3">
        <div className="flex-1 min-w-0 max-w-2xl flex flex-col gap-1.5">
          <div className="grid grid-cols-2 max-[380px]:grid-cols-1 lg:grid-cols-3 gap-1.5 shrink-0" data-tour="portal-links">
            {PORTAL_LINKS.map((link) => (
              <a
                key={link.label}
                href={getPortalHref(link)}
                target="_blank"
                rel="noopener noreferrer"
                className="group min-h-8 px-2 py-1.5 rounded-md bg-primary/10 border border-primary/35 text-[10px] sm:text-xs font-semibold text-primary hover:bg-primary/20 hover:border-primary/60 transition-colors flex items-center justify-center gap-1 text-center leading-tight max-md:min-h-11 max-md:py-2.5 max-md:text-xs max-md:leading-snug"
              >
                <span>{link.label}</span>
                <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-70 group-hover:opacity-100" />
              </a>
            ))}
          </div>

          <div data-tour="matematica-financeira" className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => toggle(MAT_FIN_PANEL_ID)}
              aria-expanded={matFinOpen}
              className={`group w-full min-h-8 px-2 py-1.5 rounded-md border text-[10px] sm:text-xs font-semibold transition-colors flex items-center justify-center gap-1 text-center leading-tight max-md:min-h-11 max-md:py-2.5 max-md:text-xs max-md:leading-snug ${
                matFinOpen
                  ? "bg-emerald-500/20 border-emerald-500/60 text-emerald-700 dark:text-emerald-300"
                  : "bg-emerald-500/10 border-emerald-500/35 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-500/60"
              }`}
            >
              <BookOpen className="w-2.5 h-2.5 shrink-0 opacity-80" />
              <span>Matemática Financeira · 1º sem. 2026</span>
              <ChevronDown
                className={`w-2.5 h-2.5 shrink-0 opacity-70 transition-transform ${matFinOpen ? "rotate-180" : ""}`}
              />
            </button>

            {matFinOpen && <MatematicaFinanceiraPanel />}
          </div>

          <div data-tour="hp12c" className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => toggle(HP12C_PANEL_ID)}
              aria-expanded={hp12cOpen}
              className={`group w-full min-h-8 px-2 py-1.5 rounded-md border text-[10px] sm:text-xs font-semibold transition-colors flex items-center justify-center gap-1 text-center leading-tight max-md:min-h-11 max-md:py-2.5 max-md:text-xs max-md:leading-snug ${
                hp12cOpen
                  ? "bg-primary/20 border-primary/60 text-primary"
                  : "bg-primary/10 border-primary/35 text-primary hover:bg-primary/20 hover:border-primary/60"
              }`}
            >
              <Calculator className="w-2.5 h-2.5 shrink-0 opacity-80" />
              <span>Calculadora HP-12C</span>
              <ChevronDown
                className={`w-2.5 h-2.5 shrink-0 opacity-70 transition-transform ${hp12cOpen ? "rotate-180" : ""}`}
              />
            </button>

            {hp12cOpen && (
              <div className="w-full glass-card neon-border rounded-lg p-1.5 sm:p-2 overflow-visible">
                <Hp12cCalculatorPanel compact />
              </div>
            )}
          </div>
        </div>

        <div
          className="flex flex-col gap-1.5 shrink-0 md:min-w-[12rem] lg:min-w-[15rem] xl:min-w-[16rem] max-md:w-full max-md:min-w-0"
          data-tour="video-tutorials"
        >
          {TUTORIAL_VIDEOS.map((tutorial) => {
            const isOpen = openId === tutorial.id

            return (
              <button
                key={tutorial.id}
                type="button"
                onClick={() => toggle(tutorial.id)}
                aria-expanded={isOpen}
                className={`group min-h-8 px-2 py-1.5 rounded-md border text-[10px] sm:text-xs font-semibold transition-colors flex items-center justify-center gap-1 text-center leading-tight max-md:min-h-11 max-md:py-2.5 max-md:text-xs max-md:leading-snug ${
                  isOpen
                    ? "bg-accent/20 border-accent/60 text-accent-foreground"
                    : "bg-accent/10 border-accent/35 text-accent hover:bg-accent/20 hover:border-accent/60"
                }`}
              >
                <PlayCircle className="w-2.5 h-2.5 shrink-0 opacity-80" />
                <span>{tutorial.label}</span>
                <ChevronDown
                  className={`w-2.5 h-2.5 shrink-0 opacity-70 transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
              </button>
            )
          })}
        </div>
      </div>

      {openTutorial && (
        <div className="glass-card neon-border rounded-lg p-2 sm:p-3">
          <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground mb-2 px-1">
            {openTutorial.label}
          </p>
          <iframe
            key={openTutorial.id}
            src={openTutorial.src}
            title={openTutorial.label}
            className="w-full aspect-video rounded-md border border-border bg-black"
            allow="autoplay; fullscreen"
            allowFullScreen
          />
        </div>
      )}
    </div>
  )
}
