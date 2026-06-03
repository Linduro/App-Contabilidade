"use client"

import { useState } from "react"
import { ChevronDown, PlayCircle } from "lucide-react"
import { TUTORIAL_VIDEOS } from "@/lib/tutorial-videos"

export function HeaderTutorialButtons() {
  const [openId, setOpenId] = useState<string | null>(null)

  const toggle = (id: string) => {
    setOpenId((current) => (current === id ? null : id))
  }

  const openTutorial = TUTORIAL_VIDEOS.find((tutorial) => tutorial.id === openId)

  return (
    <div className="mt-1.5 w-full max-w-2xl">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-1.5">
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

      {openTutorial && (
        <div className="mt-2 glass-card neon-border rounded-lg p-2 sm:p-3">
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
