"use client"

import { useEffect, useState } from "react"
import { ExternalLink } from "lucide-react"
import {
  subscribeActivePlatformAds,
  type AdPlacement,
  type PlatformAd,
} from "@/lib/platform-ads"

function AdBanner({ ad }: { ad: PlatformAd }) {
  const content = (
    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
      {ad.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={ad.imageUrl}
          alt=""
          className="w-full sm:w-28 h-28 object-cover rounded-lg border border-border/60 shrink-0"
        />
      )}
      <div className="flex-1 min-w-0">
        {ad.headline && (
          <p className="text-sm font-bold text-foreground mb-1">{ad.headline}</p>
        )}
        {ad.description && (
          <p className="text-xs text-muted-foreground leading-relaxed">{ad.description}</p>
        )}
        {ad.linkUrl && ad.ctaText && (
          <span className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-primary">
            {ad.ctaText}
            <ExternalLink className="w-3 h-3" />
          </span>
        )}
      </div>
    </div>
  )

  const shell = (
    <article className="rounded-xl border border-border/60 bg-secondary/25 p-4 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
        {ad.sponsorLabel || "Patrocinado"}
      </p>
      {content}
    </article>
  )

  if (ad.linkUrl) {
    return (
      <a
        href={ad.linkUrl}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="block hover:opacity-95 transition-opacity"
      >
        {shell}
      </a>
    )
  }

  return shell
}

function AdEmbed({ ad }: { ad: PlatformAd }) {
  if (!ad.embedHtml.trim()) return null

  return (
    <article className="rounded-xl border border-border/60 bg-secondary/25 p-3 overflow-hidden">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 px-1">
        {ad.sponsorLabel || "Anúncio"}
      </p>
      <div
        className="site-ad-embed text-sm"
        dangerouslySetInnerHTML={{ __html: ad.embedHtml }}
      />
    </article>
  )
}

export function SiteAdSlot({
  placement,
  className = "",
}: {
  placement: AdPlacement
  className?: string
}) {
  const [ads, setAds] = useState<PlatformAd[]>([])

  useEffect(() => {
    return subscribeActivePlatformAds(placement, setAds)
  }, [placement])

  if (ads.length === 0) return null

  return (
    <div className={`space-y-3 ${className}`} data-ad-placement={placement}>
      {ads.map((ad) =>
        ad.format === "embed" ? (
          <AdEmbed key={ad.id} ad={ad} />
        ) : (
          <AdBanner key={ad.id} ad={ad} />
        )
      )}
    </div>
  )
}
