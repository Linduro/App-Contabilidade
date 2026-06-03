import { assetPath } from "./base-path"

export const TUTORIAL_VIDEOS = [
  {
    id: "acesso-pagamentos",
    label: "Tutorial de acesso ao pagamentos",
    src: assetPath("/videos/tutorial-acesso-pagamentos.html"),
  },
  {
    id: "servicos-diversos",
    label: "Tutorial de Solicitação de Serviços Diversos",
    src: assetPath("/videos/tutorial-solicitacao-servicos-diversos.html"),
  },
  {
    id: "declaracao-matricula",
    label: "Tutorial de Solicitação de Declaração de Matrícula",
    src: assetPath("/videos/tutorial-solicitacao-declaracao-matricula.html"),
  },
] as const
