import { assetPath } from "@/lib/base-path"
import { SITE_FOOTER_NOTE } from "@/lib/site-copy"

export function SiteFooter() {
  return (
    <footer className="relative z-10 border-t border-border/50 py-8 px-6 overflow-visible">
      <div className="max-w-6xl mx-auto relative min-h-[7rem] sm:min-h-[8rem]">
        <p className="text-xs text-muted-foreground max-w-3xl mx-auto text-center leading-relaxed pr-32 sm:pr-44">
          {SITE_FOOTER_NOTE}
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={assetPath("/dr-pitoco-transparent.png")}
          alt="Dr Pitoco"
          className="absolute -bottom-4 right-0 w-32 sm:w-40 md:w-44 h-auto object-contain object-bottom pointer-events-none select-none"
        />
      </div>
    </footer>
  )
}
