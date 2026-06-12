import { prisma } from "@/lib/prisma";
import { PublicationThread } from "@/components/rede-teste/feed/publication-thread";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pub = await prisma.redeTestePublication.findUnique({
    where: { id },
    select: {
      content: true,
      isConfidential: true,
      author: {
        select: {
          name: true,
          juridiquesProfile: { select: { displayName: true } },
        },
      },
    },
  });

  if (!pub) return { title: "Publicação — Rede Teste" };
  const authorName = pub.author.juridiquesProfile?.displayName ?? pub.author.name;
  const snippet = pub.isConfidential
    ? "Publicação com sigilo profissional"
    : pub.content.trim().slice(0, 80);
  return {
    title: `${authorName} no Rede Teste: "${snippet}"`,
  };
}

export default async function PublicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!id) return null;
  return <PublicationThread publicationId={id} />;
}
