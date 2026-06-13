import { JurisdicaoPostView } from "@/components/jurisdicao/jurisdicao-post-view";

type Props = { params: Promise<{ handle: string; id: string }> };

export async function generateMetadata({ params }: Props) {
  const { handle } = await params;
  return { title: `@${handle} — Jurisdição` };
}

export default async function JurisdicaoPostPage({ params }: Props) {
  const { handle, id } = await params;
  return <JurisdicaoPostView handle={handle} id={id} />;
}
