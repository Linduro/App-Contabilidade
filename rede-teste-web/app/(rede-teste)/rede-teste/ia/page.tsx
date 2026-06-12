import { redirect } from "next/navigation";

/** Rota legada — o menu usa /rede-teste/assistente */
export default function RedeTesteIaRedirectPage() {
  redirect("/rede-teste/assistente");
}
