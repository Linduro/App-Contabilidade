import { HP12C_CALCULATOR_TITLE, HP12C_CALCULATOR_URL } from "@/lib/hp12c-calculator"

export function Hp12cCalculatorPanel() {
  return (
    <div className="glass-card neon-border rounded-lg p-2 sm:p-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3 px-1">
        <div>
          <p className="text-xs sm:text-sm font-semibold text-foreground">Calculadora HP-12C</p>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
            Emulador online para provas e exercícios de matemática financeira.
          </p>
        </div>
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
