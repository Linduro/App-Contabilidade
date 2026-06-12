import { assetPath } from "@/lib/base-path"
import { SITE_FOOTER_NOTE, SITE_FOOTER_TAGLINE } from "@/lib/site-copy"
import { SiteAdSlot } from "@/components/site-ad-slot"

export function SiteFooter() {
  return (
    <footer className="relative z-10 border-t border-border/50 bg-secondary/15 px-4 sm:px-6 py-8 sm:py-10 overflow-visible max-md:overflow-hidden max-md:pb-24">
      <div className="max-w-6xl mx-auto relative min-h-[10rem] sm:min-h-[12rem] lg:min-h-[14rem] max-md:min-h-[14rem] flex items-center">
        {/* Dr Pitoco — alinhado verticalmente com o bloco de mensagem */}
        <div
          className="pointer-events-none select-none absolute z-0 right-0 top-1/2 -translate-y-[58%] sm:-translate-y-[60%] lg:-translate-y-[62%] flex flex-col items-end"
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

        {/* Mensagem — deslocada para baixo e à direita */}
        <div className="relative z-10 max-w-[min(100%,34rem)] lg:max-w-[min(58%,36rem)] ml-5 sm:ml-10 lg:ml-14 mt-5 sm:mt-7 lg:mt-8 text-center lg:text-left max-md:max-w-full max-md:pr-14 max-md:text-left max-md:ml-3 max-md:mt-4 space-y-4">
          <p className="text-sm font-semibold text-foreground/85 mb-2 max-md:text-base">{SITE_FOOTER_TAGLINE}</p>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-md:text-sm">{SITE_FOOTER_NOTE}</p>
          <SiteAdSlot placement="footer" />
        </div>
      </div>
    </footer>
  )
}
