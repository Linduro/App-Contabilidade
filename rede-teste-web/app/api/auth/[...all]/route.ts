import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { NextResponse } from "next/server";

const handlers = toNextJsHandler(auth.handler);

export const GET = handlers.GET;

export async function POST(req: Request) {
  const url = new URL(req.url);
  if (url.pathname.includes("/sign-up/")) {
    return NextResponse.json(
      { error: "Cadastro público desativado. Solicite criação ao administrador." },
      { status: 403 },
    );
  }
  return handlers.POST(req);
}
