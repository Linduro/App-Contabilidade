"use client"

import { useEffect, useRef, useState } from "react"
import { HP12C_CALCULATOR_TITLE, HP12C_CALCULATOR_URL } from "@/lib/hp12c-calculator"

const SOURCE_WIDTH = 900
const SOURCE_HEIGHT = 700
const SCALE_BOOST = 1.1

function Hp12cCompactFrame() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const updateScale = () => {
      const width = element.clientWidth
      if (width > 0) {
        const boost = window.matchMedia("(min-width: 768px)").matches ? SCALE_BOOST : 1
        setScale((width / SOURCE_WIDTH) * boost)
      }
    }

    updateScale()
    const observer = new ResizeObserver(updateScale)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const frameHeight = Math.round(SOURCE_HEIGHT * scale)

  return (
    <div ref={containerRef} className="w-full">
      <div
        className="w-full overflow-hidden rounded-md border border-border bg-[#1a1a1a] shadow-inner"
        style={{ height: frameHeight }}
      >
        <iframe
          src={HP12C_CALCULATOR_URL}
          title={HP12C_CALCULATOR_TITLE}
          className="border-0 pointer-events-auto block"
          style={{
            width: SOURCE_WIDTH,
            height: SOURCE_HEIGHT,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
          scrolling="no"
          loading="lazy"
          allow="fullscreen"
        />
      </div>
    </div>
  )
}

export function Hp12cCalculatorPanel({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="flex w-full flex-col gap-1.5">
        <Hp12cCompactFrame />
        <a
          href={HP12C_CALCULATOR_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] sm:text-xs font-semibold text-primary hover:text-primary/80 text-center max-md:text-xs"
        >
          Abrir em tela cheia
        </a>
      </div>
    )
  }

  return (
    <div className="glass-card neon-border rounded-lg p-2 sm:p-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3 px-1">
        <p className="text-xs sm:text-sm font-semibold text-foreground">Calculadora HP-12C</p>
        <a
          href={HP12C_CALCULATOR_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] sm:text-xs font-semibold text-primary hover:text-primary/80 shrink-0"
        >
          Abrir em nova aba
        </a>
      </div>
      <div className="w-full max-w-[900px] mx-auto overflow-hidden rounded-md border border-border bg-[#1a1a1a] shadow-inner">
        <iframe
          src={HP12C_CALCULATOR_URL}
          title={HP12C_CALCULATOR_TITLE}
          className="block w-full h-[min(700px,72vh)] max-h-[700px] border-0"
          scrolling="no"
          loading="lazy"
          allow="fullscreen"
        />
      </div>
    </div>
  )
}
