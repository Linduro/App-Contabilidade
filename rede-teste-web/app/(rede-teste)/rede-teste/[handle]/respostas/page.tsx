import { ProfilePostsTab } from "@/components/rede-teste/profile/profile-posts-tab";

export default function ProfileRepliesPage() {
  return <ProfilePostsTab query="userReplies" emptyMessage="Nenhuma resposta pública." />;
}
