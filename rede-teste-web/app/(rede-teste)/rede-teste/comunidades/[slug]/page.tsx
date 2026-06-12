import { CommunityFeedView } from "@/components/rede-teste/comunidades/community-feed-view";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  return { title: `${slug} — Comunidade — Rede Teste` };
}

export default async function RedeTesteComunidadeSlugPage({ params }: Props) {
  const { slug } = await params;
  return <CommunityFeedView slug={slug} />;
}
