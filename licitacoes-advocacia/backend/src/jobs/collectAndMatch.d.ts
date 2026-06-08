export interface JobStats {
  licitacoesColetadas: number;
  licitacoesNovas: number;
  matchesCriados: number;
  emailsEnviados: number;
  erros: number;
}

export function runCollectAndMatch(): Promise<JobStats>;

export function runNotifications(): Promise<{
  emailsEnviados: number;
  erros: number;
}>;

export function runMatchingForLicitacao(
  item: unknown,
  licitacaoId: string,
  especialidadesBySlug: Map<string, string>,
): Promise<number>;

declare const _default: typeof runCollectAndMatch;
export default _default;
