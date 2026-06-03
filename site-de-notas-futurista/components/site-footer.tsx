import { assetPath } from "@/lib/base-path"
import { SITE_FOOTER_NOTE } from "@/lib/site-copy"

export function SiteFooter() {
  return (
    <footer className="relative z-10 border-t border-border/50 py-8 px-6 overflow-hidden">
      <div className="max-w-6xl mx-auto relative min-h-[4.5rem]">
        <p className="text-xs text-muted-foreground max-w-3xl mx-auto text-center leading-relaxed pr-24 sm:pr-32">
          {SITE_FOOTER_NOTE}
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={assetPath("/dr-pitoco.png")}
          alt="Dr Pitoco"
          className="absolute -bottom-2 right-0 w-[5.5rem] sm:w-28 h-auto object-contain object-bottom pointer-events-none select-none"
        />
      </div>
    </footer>
  )
}
