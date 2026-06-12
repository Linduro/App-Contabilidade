import { ProfilePostsTab } from "@/components/rede-teste/profile/profile-posts-tab";

export default function ProfileLikesPage() {
  return <ProfilePostsTab query="userLikedPublications" emptyMessage="Nenhuma curtida." />;
}
