import { assetPath } from "@/lib/base-path"
import { SITE_FOOTER_NOTE } from "@/lib/site-copy"

export function SiteFooter() {
  return (
    <footer className="relative z-10 border-t border-border/50 pt-8 pb-2 px-6 overflow-visible">
      <div className="max-w-6xl mx-auto relative min-h-[11rem] sm:min-h-[13rem] md:min-h-[15rem]">
        <p className="text-xs text-muted-foreground max-w-3xl mx-auto text-center leading-relaxed pr-44 sm:pr-52 md:pr-64 lg:pr-72">
          {SITE_FOOTER_NOTE}
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={assetPath("/dr-pitoco-transparent.png")}
          alt="Dr Pitoco"
          className="absolute bottom-0 right-0 h-52 sm:h-60 md:h-72 lg:h-80 w-auto max-w-[min(46vw,20rem)] sm:max-w-none object-contain object-bottom pointer-events-none select-none"
        />
      </div>
    </footer>
  )
}
