import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { type LegalNewsItem } from "@/lib/rede-teste/legal-news";

export const revalidate = 1800;

/** Quantas notícias buscar por feed (pool grande p/ widget e aba do Explorar). */
const ITEMS_PER_FEED = 20;

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

type Feed = { url: string; source: string; googleNews?: boolean };

/** Migalhas não tem RSS público e o feed de Justiça do G1 está vazio: usamos o Google News. */
function googleNewsFeed(query: string): string {
  const q = encodeURIComponent(`${query} when:7d`);
  return `https://news.google.com/rss/search?q=${q}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
}

const FEEDS: Feed[] = [
  { url: "https://www.conjur.com.br/rss.xml", source: "ConJur" },
  { url: "https://www.infomoney.com.br/feed/", source: "InfoMoney" },
  { url: googleNewsFeed("site:migalhas.com.br"), source: "Migalhas", googleNews: true },
  {
    url: googleNewsFeed(
      "site:g1.globo.com (justiça OR STF OR STJ OR direito OR juiz OR tribunal OR processo)",
    ),
    source: "G1 Justiça",
    googleNews: true,
  },
];

function stripHtml(s: string) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function itemId(url: string) {
  return createHash("sha1").update(url).digest("hex").slice(0, 16);
}

function parseRss(xml: string, feed: Feed): LegalNewsItem[] {
  const items: LegalNewsItem[] = [];
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
  for (const block of blocks.slice(0, ITEMS_PER_FEED)) {
    const title =
      block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i)?.[1] ??
      block.match(/<title>([\s\S]*?)<\/title>/i)?.[1];
    const link =
      block.match(/<link>([\s\S]*?)<\/link>/i)?.[1]?.trim() ??
      block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i)?.[1]?.trim();
    const descRaw =
      block.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i)?.[1] ??
      block.match(/<description>([\s\S]*?)<\/description>/i)?.[1] ??
      block.match(/<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/i)?.[1];
    const pubDate = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1];
    if (!title || !link) continue;

    let cleanTitle = stripHtml(title);
    let description = stripHtml(descRaw ?? "").slice(0, 220);

    if (feed.googleNews) {
      // Título do Google News termina em " - Publicação"; descrição só repete o título.
      cleanTitle = cleanTitle.replace(/\s+[-–]\s+[^-–]+$/, "").trim() || cleanTitle;
      description = "";
    }

    let meta = feed.source;
    if (pubDate) {
      try {
        const d = new Date(pubDate);
        if (!Number.isNaN(d.getTime())) {
          meta = `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} · ${feed.source}`;
        }
      } catch {
        /* ignore */
      }
    }
    items.push({
      id: itemId(link),
      title: cleanTitle,
      description,
      meta,
      url: link,
      source: feed.source,
    });
  }
  return items;
}

export async function GET() {
  const all: LegalNewsItem[] = [];
  for (const feed of FEEDS) {
    try {
      const res = await fetch(feed.url, {
        next: { revalidate: 1800 },
        headers: { "User-Agent": BROWSER_UA },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) continue;
      const xml = await res.text();
      all.push(...parseRss(xml, feed));
    } catch {
      /* próximo feed */
    }
  }

  const seen = new Set<string>();
  const items = all.filter((n) => {
    if (seen.has(n.url)) return false;
    seen.add(n.url);
    return true;
  });

  if (!items.length) {
    return NextResponse.json({
      items: [
        {
          id: "fallback",
          title: "Notícias jurídicas indisponíveis",
          description: "Tente novamente em alguns minutos.",
          meta: "Rede Teste",
          url: "https://www.migalhas.com.br/",
          source: "Migalhas",
        },
      ] satisfies LegalNewsItem[],
    });
  }

  return NextResponse.json({ items });
}
