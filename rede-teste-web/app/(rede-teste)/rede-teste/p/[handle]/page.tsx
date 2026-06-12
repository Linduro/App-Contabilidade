import { redirect } from "next/navigation";
import { jqProfilePath } from "@/lib/rede-teste/profile-path";

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

/** Redireciona URLs antigas `/rede-teste/p/@handle` para `/rede-teste/handle`. */
export default async function LegacyProfileRedirect({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  redirect(jqProfilePath(handle));
}
