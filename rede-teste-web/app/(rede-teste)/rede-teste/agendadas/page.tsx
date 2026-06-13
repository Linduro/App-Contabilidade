import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getTRPCCaller } from "@/lib/trpc-server";
import { ScheduledPublicationsView } from "@/components/rede-teste/agendadas/scheduled-publications-view";

export default async function AgendadasPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login?next=/rede-teste/agendadas");

  const caller = await getTRPCCaller();
  const scheduled = await caller.redeTeste.listScheduledPublications();

  return <ScheduledPublicationsView initial={scheduled} />;
}
