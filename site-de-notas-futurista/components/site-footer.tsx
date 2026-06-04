import { assetPath } from "@/lib/base-path"
import { SITE_FOOTER_NOTE, SITE_FOOTER_TAGLINE } from "@/lib/site-copy"

export function SiteFooter() {
  return (
    <footer className="relative z-10 border-t border-border/50 bg-secondary/15 py-8 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-6 lg:gap-10 items-end">
        <div className="flex flex-col justify-end text-center lg:text-left order-2 lg:order-1">
          <p className="text-sm font-semibold text-foreground/80 mb-2">{SITE_FOOTER_TAGLINE}</p>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl mx-auto lg:mx-0">
            {SITE_FOOTER_NOTE}
          </p>
        </div>

        <div
          className="flex flex-col items-center lg:items-end justify-end order-1 lg:order-2 shrink-0"
          data-tour="dr-pitoco"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={assetPath("/dr-pitoco-transparent.png")}
            alt="Dr Pitoco"
            className="h-40 sm:h-48 md:h-52 lg:h-56 w-auto max-w-[min(100%,14rem)] object-contain object-bottom pointer-events-none select-none"
          />
          <p className="text-xs font-bold text-muted-foreground/80 mt-1 tracking-wide">Dr Pitoco</p>
        </div>
      </div>
    </footer>
  )
}
