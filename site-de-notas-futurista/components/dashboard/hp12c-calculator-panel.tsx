import { HP12C_CALCULATOR_TITLE, HP12C_CALCULATOR_URL } from "@/lib/hp12c-calculator"

const SOURCE_WIDTH = 900
const SOURCE_HEIGHT = 700
const COMPACT_SCALE = 0.36

export function Hp12cCalculatorPanel({ compact = false }: { compact?: boolean }) {
  const frameWidth = Math.round(SOURCE_WIDTH * COMPACT_SCALE)
  const frameHeight = Math.round(SOURCE_HEIGHT * COMPACT_SCALE)

  if (compact) {
    return (
      <div className="flex flex-col items-center gap-2 pt-1">
        <div
          className="overflow-hidden rounded-md border border-border bg-[#1a1a1a] shadow-inner"
          style={{ width: frameWidth, height: frameHeight }}
        >
          <iframe
            src={HP12C_CALCULATOR_URL}
            title={HP12C_CALCULATOR_TITLE}
            className="border-0 pointer-events-auto"
            style={{
              width: SOURCE_WIDTH,
              height: SOURCE_HEIGHT,
              transform: `scale(${COMPACT_SCALE})`,
              transformOrigin: "top left",
            }}
            scrolling="no"
            loading="lazy"
            allow="fullscreen"
          />
        </div>
        <a
          href={HP12C_CALCULATOR_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] sm:text-xs font-semibold text-primary hover:text-primary/80"
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
