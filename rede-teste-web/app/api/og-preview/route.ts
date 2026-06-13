import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/me-auth";
import { prisma } from "@/lib/prisma";
import { fetchOgPreview, hashOgUrl, isOgUrlAllowed } from "@/lib/rede-teste/og-preview";

const inputSchema = z.object({ url: z.string().url().max(2000) });

const CACHE_DAYS = 7;

export async function POST(req: Request) {
  const ctx = await requireApiSession(req);
  if (!ctx) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  let body: z.infer<typeof inputSchema>;
  try {
    body = inputSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "URL inválida" }, { status: 400 });
  }

  if (!isOgUrlAllowed(body.url)) {
    return NextResponse.json({ error: "URL não permitida" }, { status: 400 });
  }

  const urlHash = hashOgUrl(body.url);
  const cached = await prisma.redeTesteLinkPreviewCache.findUnique({
    where: { urlHash },
  });
  if (cached && cached.expiresAt > new Date()) {
    return NextResponse.json({
      url: cached.url,
      title: cached.title,
      description: cached.description,
      image: cached.image,
      siteName: cached.siteName,
    });
  }

  try {
    const preview = await fetchOgPreview(body.url);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + CACHE_DAYS);

    await prisma.redeTesteLinkPreviewCache.upsert({
      where: { urlHash },
      create: {
        urlHash,
        url: preview.url,
        title: preview.title,
        description: preview.description,
        image: preview.image,
        siteName: preview.siteName,
        expiresAt,
      },
      update: {
        url: preview.url,
        title: preview.title,
        description: preview.description,
        image: preview.image,
        siteName: preview.siteName,
        expiresAt,
      },
    });

    return NextResponse.json(preview);
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Não foi possível gerar a pré-visualização";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
