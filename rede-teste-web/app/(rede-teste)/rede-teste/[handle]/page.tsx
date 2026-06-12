import { ProfilePostsTab } from "@/components/rede-teste/profile/profile-posts-tab";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  return {
    title: `@${handle.replace(/^@/, "")} — Rede Teste`,
  };
}

export default function ProfilePublicationsPage() {
  return (
    <ProfilePostsTab
      query="userPublications"
      emptyMessage="Nenhuma publicação principal ainda."
    />
  );
}
