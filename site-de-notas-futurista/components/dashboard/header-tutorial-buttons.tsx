"use client"

import { useState } from "react"
import { ChevronDown, ExternalLink, PlayCircle } from "lucide-react"
import { getPortalHref, PORTAL_LINKS } from "@/lib/portal-links"
import { TUTORIAL_VIDEOS } from "@/lib/tutorial-videos"

export function HeaderTutorialButtons() {
  const [openId, setOpenId] = useState<string | null>(null)

  const toggle = (id: string) => {
    setOpenId((current) => (current === id ? null : id))
  }

  const openTutorial = TUTORIAL_VIDEOS.find((tutorial) => tutorial.id === openId)

  return (
    <div className="mt-3 w-full space-y-2">
      <div className="flex flex-col md:flex-row md:items-start gap-2 md:gap-3">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-1.5 flex-1 max-w-2xl">
          {PORTAL_LINKS.map((link) => (
            <a
              key={link.label}
              href={getPortalHref(link)}
              target="_blank"
              rel="noopener noreferrer"
              className="group min-h-8 px-2 py-1.5 rounded-md bg-primary/10 border border-primary/35 text-[10px] sm:text-xs font-semibold text-primary hover:bg-primary/20 hover:border-primary/60 transition-colors flex items-center justify-center gap-1 text-center leading-tight"
            >
              <span>{link.label}</span>
              <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-70 group-hover:opacity-100" />
            </a>
          ))}
        </div>

        <div className="flex flex-col gap-1.5 shrink-0 md:min-w-[12rem] lg:min-w-[15rem] xl:min-w-[16rem]">
          {TUTORIAL_VIDEOS.map((tutorial) => {
            const isOpen = openId === tutorial.id

            return (
              <button
                key={tutorial.id}
                type="button"
                onClick={() => toggle(tutorial.id)}
                aria-expanded={isOpen}
                className={`group min-h-8 px-2 py-1.5 rounded-md border text-[10px] sm:text-xs font-semibold transition-colors flex items-center justify-center gap-1 text-center leading-tight ${
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
