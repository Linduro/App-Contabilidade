/** Atualize os hrefs dos PDFs quando o usuário enviar os links permanentes. */
export const PORTAL_LINKS = [
  { label: "Portal de Aulas", href: "https://fipecafi.blackboard.com/?new_loc=%2Fultra" },
  { label: "Portal de solicitações e financeiro", href: "https://sistemas.fipecafi.org/PortalWebAluno" },
  { label: "Minha Biblioteca", href: "https://sso.minhabiblioteca.com.br/Login.aspx?key=FIPECAFI" },
  {
    label: "Guia de Provas",
    href: "https://fipecafi.blackboard.com/",
    pdfKey: "guiaProvas" as const,
  },
  {
    label: "Calendário 2026",
    href: "https://fipecafi.blackboard.com/",
    pdfKey: "calendario2026" as const,
  },
  {
    label: "Guia do Aluno",
    href: "https://fipecafi.blackboard.com/",
    pdfKey: "guiaAluno" as const,
  },
]

export const PDF_LINKS: Record<"guiaProvas" | "calendario2026" | "guiaAluno", string> = {
  guiaProvas: "",
  calendario2026: "",
  guiaAluno: "",
}

export function getPortalHref(link: (typeof PORTAL_LINKS)[number]) {
  if ("pdfKey" in link && link.pdfKey && PDF_LINKS[link.pdfKey]) {
    return PDF_LINKS[link.pdfKey]
  }
  return link.href
}
