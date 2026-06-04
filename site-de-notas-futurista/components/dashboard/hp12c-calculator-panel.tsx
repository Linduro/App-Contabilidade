import { HP12C_CALCULATOR_TITLE, HP12C_CALCULATOR_URL } from "@/lib/hp12c-calculator"

export function Hp12cCalculatorPanel({ embedded = false }: { embedded?: boolean }) {
  return (
    <div
      className={
        embedded
          ? "h-full flex flex-col min-h-0"
          : "glass-card neon-border rounded-lg p-2 sm:p-3"
      }
    >
      <div
        className={`flex items-center justify-between gap-2 shrink-0 ${
          embedded ? "mb-1.5 px-0.5" : "flex-col sm:flex-row sm:items-center mb-3 px-1"
        }`}
      >
        <div>
          <p
            className={
              embedded
                ? "text-[10px] sm:text-xs font-semibold text-foreground"
                : "text-xs sm:text-sm font-semibold text-foreground"
            }
          >
            Calculadora HP-12C
          </p>
          {!embedded && (
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
              Emulador online para provas e exercícios de matemática financeira.
            </p>
          )}
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

      <div
        className={`w-full overflow-hidden rounded-md border border-border bg-[#1a1a1a] shadow-inner ${
          embedded ? "flex-1 min-h-[280px] sm:min-h-[360px] lg:min-h-[420px]" : "max-w-[900px] mx-auto"
        }`}
      >
        <iframe
          src={HP12C_CALCULATOR_URL}
          title={HP12C_CALCULATOR_TITLE}
          className={`block w-full border-0 ${
            embedded
              ? "h-full min-h-[280px] sm:min-h-[360px] lg:min-h-[420px]"
              : "h-[min(700px,72vh)] max-h-[700px]"
          }`}
          scrolling="no"
          loading="lazy"
          allow="fullscreen"
        />
      </div>
    </div>
  )
}
