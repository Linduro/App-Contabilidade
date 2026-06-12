import { ProfilePostsTab } from "@/components/rede-teste/profile/profile-posts-tab";

export default function ProfileHighlightsPage() {
  return (
    <ProfilePostsTab
      query="userHighlights"
      emptyMessage="Marque publicações como destaque no menu ⋯ de cada post (em breve no card)."
    />
  );
}
