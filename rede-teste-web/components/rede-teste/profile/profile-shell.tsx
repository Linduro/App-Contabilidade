"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { isReservedJqHandle } from "@/lib/rede-teste/reserved-handles";
import { Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import { ProfileProvider } from "./profile-context";
import { ProfileHeader } from "./profile-header";
import { ProfileTabs } from "./profile-tabs";

export function ProfileShell({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const router = useRouter();
  const raw = typeof params.handle === "string" ? params.handle : "";
  const handle = raw.replace(/^@/, "").toLowerCase();

  useEffect(() => {
    if (handle && isReservedJqHandle(handle)) {
      router.replace("/rede-teste");
    }
  }, [handle, router]);

  const profile = trpc.redeTeste.profileByHandle.useQuery(
    { handle },
    { enabled: handle.length > 0 },
  );

  if (profile.isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="size-8 animate-spin text-[var(--jq-muted)]" />
      </div>
    );
  }

  if (profile.isError || !profile.data) {
    return (
      <div className="p-8 text-center">
        <p className="font-bold">Perfil não encontrado</p>
        <Link
          href="/rede-teste"
          className="mt-4 inline-block text-sm text-[var(--jq-reply)] hover:underline"
        >
          Voltar ao início
        </Link>
      </div>
    );
  }

  return (
    <ProfileProvider profile={profile.data}>
      <ProfileHeader />
      <ProfileTabs />
      {children}
    </ProfileProvider>
  );
}
