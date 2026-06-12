import { ProfilePostsTab } from "@/components/rede-teste/profile/profile-posts-tab";

export default function ProfileMediaPage() {
  return <ProfilePostsTab query="userMedia" emptyMessage="Nenhuma publicação com mídia." />;
}
