import { assetPath } from "@/lib/base-path"
import { SITE_FOOTER_NOTE } from "@/lib/site-copy"

export function SiteFooter() {
  return (
    <footer className="relative z-10 border-t border-border/50 py-8 px-4 sm:px-6 overflow-visible">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 sm:gap-6">
        <p className="text-xs text-muted-foreground flex-1 text-center sm:text-left leading-relaxed max-w-3xl">
          {SITE_FOOTER_NOTE}
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={assetPath("/dr-pitoco-transparent.png")}
          alt="Dr Pitoco"
          className="shrink-0 self-end sm:self-auto ml-auto h-52 sm:h-60 md:h-72 lg:h-80 w-auto object-contain object-bottom pointer-events-none select-none"
        />
      </div>
    </footer>
  )
}
