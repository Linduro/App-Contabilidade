import { JurisdicaoBlogView } from "@/components/jurisdicao/jurisdicao-blog-view";

type Props = { params: Promise<{ handle: string }> };

export async function generateMetadata({ params }: Props) {
  const { handle } = await params;
  return { title: `@${handle} — Jurisdição` };
}

export default async function JurisdicaoBlogPage({ params }: Props) {
  const { handle } = await params;
  return <JurisdicaoBlogView handle={handle} />;
}
