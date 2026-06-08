/** Catálogo de especialidades jurídicas (slug = id no Firestore). */
export const ESPECIALIDADES_CATALOG = [
  {
    slug: "responsabilidade_civil",
    nome: "Responsabilidade Civil",
    descricao: "Indenizações, danos morais/materiais e sinistros.",
    palavras_chave: ["indenização", "danos", "sinistro", "responsabilidade civil"],
  },
  {
    slug: "banking_law",
    nome: "Direito Bancário",
    descricao: "Contratos bancários, crédito e hipoteca.",
    palavras_chave: ["banco", "financeira", "crédito", "hipoteca"],
  },
  {
    slug: "tributario",
    nome: "Direito Tributário",
    descricao: "Impostos, declarações e consultoria fiscal.",
    palavras_chave: ["imposto", "icms", "iss", "declaração", "tributário"],
  },
  {
    slug: "administrativo",
    nome: "Direito Administrativo",
    descricao: "Contratos públicos, editais e licitações.",
    palavras_chave: ["contrato", "edital", "licitação", "administrativo"],
  },
  {
    slug: "security",
    nome: "Direito Previdenciário",
    descricao: "INSS, benefícios, perícias e aposentadoria.",
    palavras_chave: ["inss", "benefício", "perícia", "aposentadoria", "previdenciário"],
  },
];

export const OWNER_CONFIG = {
  id: "owner",
  nome: "Cartoon HQ",
  email: "cartoonhq@gmail.com",
  ativo: true,
  especialidades: [
    { slug: "banking_law", nivel_experiencia: "especialista" },
    { slug: "administrativo", nivel_experiencia: "especialista" },
    { slug: "tributario", nivel_experiencia: "especialista" },
    { slug: "responsabilidade_civil", nivel_experiencia: "especialista" },
    { slug: "security", nivel_experiencia: "especialista" },
  ],
};
