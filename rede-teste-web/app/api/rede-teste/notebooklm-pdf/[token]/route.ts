import { NextResponse } from "next/server";
import {
  deleteassistantTempPdf,
  isassistantBridgeSessionActive,
  openassistantTempPdfStream,
  readassistantTempPdf,
  verifyassistantPdfToken,
} from "@/lib/rede-teste/assistant-temp-pdf";

export const runtime = "nodejs";

type Params = { params: Promise<{ token: string }> };

const assistant_CORS_ORIGIN = "https://assistant.google.com";

function pdfHeaders(fileName: string, size: number) {
  return {
    "Content-Type": "application/pdf",
    "Content-Disposition": `inline; filename="${encodeURIComponent(fileName)}"`,
    "Content-Length": String(size),
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=300",
    "X-Content-Type-Options": "nosniff",
    "Access-Control-Allow-Origin": assistant_CORS_ORIGIN,
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": assistant_CORS_ORIGIN,
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Max-Age": "86400",
    },
  });
}

/** Download público via token assinado (assistant busca o PDF por URL). */
export async function GET(req: Request, { params }: Params) {
  const { token } = await params;
  const meta = verifyassistantPdfToken(decodeURIComponent(token));
  if (!meta) {
    return new NextResponse("Link expirado ou inválido", { status: 410 });
  }

  const sessionActive = await isassistantBridgeSessionActive(
    meta.sessionId,
    meta.userId,
    meta.tenantId,
  );
  if (!sessionActive) {
    return new NextResponse("Link encerrado — feche e reabra o Estagiário Artificial", {
      status: 410,
    });
  }

  try {
    const range = req.headers.get("range");
    if (range?.startsWith("bytes=")) {
      const buffer = await readassistantTempPdf(meta);
      const m = /^bytes=(\d+)-(\d+)?$/.exec(range);
      if (m) {
        const start = Number(m[1]);
        const end = m[2] ? Number(m[2]) : buffer.length - 1;
        const chunk = buffer.subarray(start, Math.min(end + 1, buffer.length));
        return new NextResponse(chunk, {
          status: 206,
          headers: {
            ...pdfHeaders(meta.fileName, chunk.length),
            "Content-Range": `bytes ${start}-${start + chunk.length - 1}/${buffer.length}`,
          },
        });
      }
    }

    const { body, size } = await openassistantTempPdfStream(meta);
    return new NextResponse(body, {
      status: 200,
      headers: pdfHeaders(meta.fileName, size),
    });
  } catch {
    await deleteassistantTempPdf(meta).catch(() => {});
    return new NextResponse(null, { status: 404 });
  }
}
