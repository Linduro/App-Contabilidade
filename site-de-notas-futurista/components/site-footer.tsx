import { assetPath } from "@/lib/base-path"
import { SITE_FOOTER_NOTE, SITE_FOOTER_TAGLINE } from "@/lib/site-copy"

export function SiteFooter() {
  return (
    <footer className="relative z-10 border-t border-border/50 bg-secondary/15 px-4 sm:px-6 py-8 sm:py-10 overflow-visible max-md:overflow-hidden max-md:pb-24">
      <div className="max-w-6xl mx-auto relative min-h-[10rem] sm:min-h-[12rem] lg:min-h-[14rem] max-md:min-h-[14rem]">
        {/* Dr Pitoco — região direita, maior, atrás do texto */}
        <div
          className="pointer-events-none select-none absolute z-0 right-0 top-0 sm:top-1 lg:-top-2 flex flex-col items-end"
          data-tour="dr-pitoco"
          aria-hidden="true"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={assetPath("/dr-pitoco-transparent.png")}
            alt=""
            className="h-44 sm:h-56 md:h-64 lg:h-72 xl:h-80 w-auto object-contain object-top drop-shadow-lg opacity-95 max-md:h-28 max-md:opacity-40 max-md:-right-2"
          />
        </div>

        {/* Mensagem — região esquerda (área circulada), à frente */}
        <div className="relative z-10 max-w-[min(100%,34rem)] lg:max-w-[min(58%,36rem)] pt-1 lg:pt-3 text-center lg:text-left max-md:max-w-full max-md:pr-14 max-md:text-left">
          <p className="text-sm font-semibold text-foreground/85 mb-2 max-md:text-base">{SITE_FOOTER_TAGLINE}</p>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-md:text-sm">{SITE_FOOTER_NOTE}</p>
        </div>
      </div>
    </footer>
  )
}
