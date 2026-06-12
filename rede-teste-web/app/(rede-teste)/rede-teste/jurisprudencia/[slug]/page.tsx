import { JurisDetailView } from "@/components/rede-teste/jurisprudencia/juris-detail-view";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ publicar?: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  return { title: `${slug} — Jurisprudência` };
}

export default async function JurisDetailPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  return <JurisDetailView slug={slug} openPublish={sp.publicar === "1"} />;
}
