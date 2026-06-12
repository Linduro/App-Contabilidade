import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function zodErrorResponse(error: ZodError) {
  const messages = error.errors.map((e) => {
    const path = e.path.length ? `${e.path.join(".")}: ` : "";
    return `${path}${e.message}`;
  });
  return NextResponse.json(
    { error: messages[0] ?? "Dados inválidos", errors: messages },
    { status: 400 },
  );
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
