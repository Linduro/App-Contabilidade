import { ProfilePublicClient } from "./profile-public-client"

/** Necessário para export estático no GitHub Pages. */
export function generateStaticParams() {
  return [{ id: "demo" }]
}

export default function PublicProfilePage({
  params,
}: {
  params: { id: string }
}) {
  return <ProfilePublicClient id={params.id} />
}
