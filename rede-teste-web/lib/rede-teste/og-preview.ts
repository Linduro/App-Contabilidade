import { createHash } from "node:crypto";

export type OgPreviewData = {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
};

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^0\./,
  /^\[::1\]$/,
];

const BLOCKED_HOSTS = new Set(["metadata.google.internal", "169.254.169.254"]);

export function hashOgUrl(url: string): string {
  return createHash("sha256").update(url).digest("hex");
}

export function sanitizeOgText(value: string | null | undefined, max = 500): string | null {
  if (!value) return null;
  return value
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/<[^>]*>/g, "")
    .trim()
    .slice(0, max);
}

export function isOgUrlAllowed(urlString: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    return false;
  }
  if (!["http:", "https:"].includes(parsed.protocol)) return false;
  const host = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host)) return false;
  if (PRIVATE_HOST_PATTERNS.some((p) => p.test(host))) return false;
  if (parsed.username || parsed.password) return false;
  return true;
}

function readMeta(html: string, property: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`,
    "i",
  );
  const m = html.match(re);
  return m?.[1] ?? null;
}

export function parseOgFromHtml(html: string, url: string): OgPreviewData {
  const title =
    sanitizeOgText(readMeta(html, "og:title")) ??
    sanitizeOgText(html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? null, 200);
  const description =
    sanitizeOgText(readMeta(html, "og:description")) ??
    sanitizeOgText(readMeta(html, "description"), 300);
  let image = sanitizeOgText(readMeta(html, "og:image"), 2000);
  if (image && image.startsWith("/")) {
    try {
      image = new URL(image, url).href;
    } catch {
      image = null;
    }
  }
  const siteName =
    sanitizeOgText(readMeta(html, "og:site_name")) ??
    (() => {
      try {
        return new URL(url).hostname;
      } catch {
        return null;
      }
    })();

  return { url, title, description, image, siteName };
}

export async function fetchOgPreview(url: string): Promise<OgPreviewData> {
  if (!isOgUrlAllowed(url)) {
    throw new Error("URL não permitida para pré-visualização.");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  let current = url;
  let html = "";

  try {
    for (let redirects = 0; redirects <= 3; redirects++) {
      const { withCircuitBreaker } = await import("@/lib/circuit-breaker");
      const res = await withCircuitBreaker("og-preview", () =>
        fetch(current, {
        signal: controller.signal,
        redirect: "manual",
        headers: {
          "User-Agent": "RedeTesteBot/1.0 (+https://portal.com)",
          Accept: "text/html,application/xhtml+xml",
        },
      }),
      );

      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc || redirects >= 3) break;
        current = new URL(loc, current).href;
        if (!isOgUrlAllowed(current)) {
          throw new Error("Redirecionamento para URL não permitida.");
        }
        continue;
      }

      if (!res.ok) throw new Error("Não foi possível carregar a página.");

      const reader = res.body?.getReader();
      if (!reader) throw new Error("Resposta vazia.");
      const chunks: Uint8Array[] = [];
      let total = 0;
      const decoder = new TextDecoder("utf-8", { fatal: false });
      while (total < 1_000_000) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        total += value.length;
        html += decoder.decode(value, { stream: true });
        if (html.includes("</head>")) break;
      }
      reader.cancel().catch(() => undefined);
      break;
    }
  } finally {
    clearTimeout(timer);
  }

  return parseOgFromHtml(html, url);
}
