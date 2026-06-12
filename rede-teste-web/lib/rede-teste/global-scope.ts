import type { Prisma } from "@prisma/client";

/**
 * Rede Teste é rede pública: leituras e descoberta não filtram por escritório (tenant),
 * EXCETO publicações marcadas como "sigilo profissional" (isConfidential), que só são
 * visíveis ao autor e aos colegas do mesmo escritório (tenant) do autor.
 * Dados do Portal (clientes, processos, intimações) continuam isolados por tenant.
 */

/** Condição de visibilidade de sigilo: público OU (sigiloso e do meu escritório/autor). */
function confidentialVisibleOr(
  viewerId: string,
  viewerTenantId?: string | null,
): Prisma.RedeTestePublicationWhereInput[] {
  const or: Prisma.RedeTestePublicationWhereInput[] = [
    { isConfidential: false },
    { isConfidential: true, authorId: viewerId },
  ];
  if (viewerTenantId) {
    or.push({ isConfidential: true, tenantId: viewerTenantId });
  }
  return or;
}

/** Publicações visíveis no feed principal (exclui rascunhos, agendadas e partes 2+ de thread). */
export function jqFeedPublishedWhere(
  extra?: Prisma.RedeTestePublicationWhereInput,
): Prisma.RedeTestePublicationWhereInput {
  return {
    status: "PUBLISHED",
    OR: [{ threadPosition: null }, { threadPosition: 0 }],
    ...extra,
  };
}

export function jqGlobalFeedWhere(
  viewerId: string,
  extra?: Prisma.RedeTestePublicationWhereInput,
  viewerTenantId?: string | null,
): Prisma.RedeTestePublicationWhereInput {
  return {
    deletedAt: null,
    parentId: null,
    status: "PUBLISHED",
    AND: [
      { OR: [{ threadPosition: null }, { threadPosition: 0 }] },
      { OR: confidentialVisibleOr(viewerId, viewerTenantId) },
    ],
    ...extra,
  };
}

export function jqPublicationVisibleWhere(
  viewerId: string,
  extra?: Prisma.RedeTestePublicationWhereInput,
  viewerTenantId?: string | null,
): Prisma.RedeTestePublicationWhereInput {
  return {
    deletedAt: null,
    OR: confidentialVisibleOr(viewerId, viewerTenantId),
    ...extra,
  };
}

export function jqRepliesWhere(
  parentId: string,
  extra?: Prisma.RedeTestePublicationWhereInput,
): Prisma.RedeTestePublicationWhereInput {
  return {
    deletedAt: null,
    parentId,
    isConfidential: false,
    ...extra,
  };
}

/** Leitura pública ou autenticada: anônimo nunca vê sigilo profissional. */
export function jqPublicReadWhere(
  viewerId: string | null | undefined,
  extra?: Prisma.RedeTestePublicationWhereInput,
  viewerTenantId?: string | null,
): Prisma.RedeTestePublicationWhereInput {
  if (!viewerId) {
    return { deletedAt: null, isConfidential: false, ...extra };
  }
  return jqPublicationVisibleWhere(viewerId, extra, viewerTenantId);
}
