import type { PrismaClient } from "@prisma/client";
import {
  isassistantBridgeSessionActive,
  listassistantSessionPdfFiles,
  readassistantTempPdf,
} from "@/lib/rede-teste/assistant-temp-pdf";

export type EstagiarioSourcesInput = {
  clientId?: string;
  caseId?: string;
  bookmarkPublicationIds?: string[];
  bridgeSessionId?: string;
  /** Texto resolvido de modelo Portal (ponte /modelos → Estagiário). */
  documentContextText?: string;
};

export type EstagiarioPdfPart = {
  fileName: string;
  mimeType: "application/pdf";
  data: string;
};

export type EstagiarioSourcesBundle = {
  textBlock: string;
  pdfParts: EstagiarioPdfPart[];
  summary: string;
};

const MAX_BOOKMARK_CHARS = 12_000;
const MAX_PDF_BYTES = 20 * 1024 * 1024;
const MAX_PDFS = 5;

export async function buildEstagiarioSources(
  prisma: PrismaClient,
  ctx: { tenantId: string; userId: string },
  input: EstagiarioSourcesInput,
): Promise<EstagiarioSourcesBundle> {
  const sections: string[] = [];
  const summaryParts: string[] = [];

  if (input.documentContextText?.trim()) {
    const slice = input.documentContextText.trim().slice(0, 50_000);
    sections.push("## Documento do Portal (modelo resolvido)", slice, "");
    summaryParts.push("documento Portal");
  }

  if (input.clientId) {
    const client = await prisma.client.findFirst({
      where: { id: input.clientId, tenantId: ctx.tenantId, deletedAt: null },
    });
    if (client) {
      sections.push(
        "## Cliente",
        `- Nome: ${client.name}`,
        client.email ? `- E-mail: ${client.email}` : "",
        client.phone ? `- Telefone: ${client.phone}` : "",
        "",
      );
      summaryParts.push("cliente");
    }
  }

  if (input.caseId) {
    const caseRow = await prisma.case.findFirst({
      where: { id: input.caseId, tenantId: ctx.tenantId, deletedAt: null },
      include: { client: { select: { name: true } } },
    });
    if (caseRow) {
      sections.push(
        "## Processo",
        `- CNJ: ${caseRow.cnjNumber}`,
        `- Título: ${caseRow.title}`,
        caseRow.courtDistrict ? `- Vara/comarca: ${caseRow.courtDistrict}` : "",
        caseRow.client ? `- Cliente vinculado: ${caseRow.client.name}` : "",
        caseRow.description ? `- Descrição: ${caseRow.description}` : "",
        "",
      );
      summaryParts.push("processo");
    }
  }

  if (input.bookmarkPublicationIds?.length) {
    const bookmarkRows = await prisma.redeTesteBookmark.findMany({
      where: {
        userId: ctx.userId,
        publicationId: { in: input.bookmarkPublicationIds },
      },
      include: {
        publication: {
          select: {
            id: true,
            content: true,
            createdAt: true,
            author: { select: { displayName: true, handle: true } },
          },
        },
      },
      take: 20,
    });

    if (bookmarkRows.length) {
      sections.push("## Fontes salvas no Rede Teste");
      let used = 0;
      for (const row of bookmarkRows) {
        const pub = row.publication;
        const content = pub?.content?.trim();
        if (!content) continue;
        const author = pub.author?.displayName ?? pub.author?.handle ?? "autor";
        const slice = content.slice(0, MAX_BOOKMARK_CHARS);
        sections.push(
          `### Fonte ${pub.id} (${author}, ${new Date(pub.createdAt).toLocaleDateString("pt-BR")})`,
          slice,
          "",
        );
        used += 1;
      }
      if (used) summaryParts.push(`${used} publicação(ões)`);
    }
  }

  const pdfParts: EstagiarioPdfPart[] = [];
  if (input.bridgeSessionId) {
    const active = await isassistantBridgeSessionActive(
      input.bridgeSessionId,
      ctx.userId,
      ctx.tenantId,
    );
    if (active) {
      const files = await listassistantSessionPdfFiles(
        ctx.tenantId,
        ctx.userId,
        input.bridgeSessionId,
      );
      let totalBytes = 0;
      for (const file of files.slice(0, MAX_PDFS)) {
        try {
          const buffer = await readassistantTempPdf({
            id: file.id,
            userId: ctx.userId,
            tenantId: ctx.tenantId,
            fileName: file.fileName,
            sessionId: input.bridgeSessionId,
            exp: Date.now() + 60_000,
          });
          if (totalBytes + buffer.length > MAX_PDF_BYTES) break;
          totalBytes += buffer.length;
          pdfParts.push({
            fileName: file.fileName,
            mimeType: "application/pdf",
            data: buffer.toString("base64"),
          });
          sections.push(`## PDF anexado: ${file.fileName}`, "(conteúdo no arquivo PDF desta mensagem)", "");
        } catch {
          // arquivo removido
        }
      }
      if (pdfParts.length) summaryParts.push(`${pdfParts.length} PDF(s)`);
    }
  }

  const textBlock =
    sections.length > 0
      ? `=== FONTES DO ESTAGIÁRIO (use SOMENTE estas informações) ===\n\n${sections.join("\n").trim()}\n\n=== FIM DAS FONTES ===`
      : "=== FONTES DO ESTAGIÁRIO ===\n(Nenhuma fonte anexada nesta sessão. Informe ao advogado que não há documentos e peça para anexar PDFs ou selecionar fontes antes de redigir peças concretas.)\n=== FIM DAS FONTES ===";

  return {
    textBlock,
    pdfParts,
    summary: summaryParts.length ? summaryParts.join(", ") : "sem fontes anexadas",
  };
}
