import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/me-auth";
import { searchTenorGifs } from "@/lib/rede-teste/tenor";
import { searchGiphyGifs } from "@/lib/rede-teste/giphy";

export async function GET(req: Request) {
  const ctx = await requireApiSession(req);
  if (!ctx) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const pos = url.searchParams.get("pos") ?? undefined;

  try {
    const result = process.env.GIPHY_API_KEY
      ? await searchGiphyGifs(q, { limit: 20, pos })
      : await searchTenorGifs(q, { limit: 20, pos });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao buscar GIFs";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
