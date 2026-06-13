import { redirect } from "next/navigation";
import { RedeTesteModerationPanel } from "@/components/rede-teste/moderation/rede-teste-moderation-panel";
import { getTRPCCaller } from "@/lib/trpc-server";

export const metadata = { title: "Moderação — Rede Teste" };

export default async function RedeTesteModeracaoPage() {
  const caller = await getTRPCCaller();
  const me = await caller.redeTeste.me();
  if (!me.isOwner) {
    redirect("/rede-teste");
  }
  return <RedeTesteModerationPanel />;
}
