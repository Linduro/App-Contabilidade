export const DEFAULT_TRABALHISTA_SETTINGS = {
  enabled: false,
  collect_enabled: true,
  outreach_enabled: true,
  datajud_api_key: "",
  datajud_trts: "1,2,3,15",
  datajud_days_back: 7,
  datajud_page_size: 50,
  evolution_api_url: "",
  evolution_api_key: "",
  evolution_instance: "default",
  smtp_host: "smtp.gmail.com",
  smtp_port: 587,
  smtp_user: "",
  smtp_pass: "",
  smtp_from: "",
  whatsapp_template:
    "Olá {responsavel}, identificamos um processo trabalhista ({processo}) contra {empresa}. Podemos ajudar?",
  email_subject: "Processo trabalhista — {empresa}",
  email_template:
    "Prezado(a) {responsavel},\n\nProcesso {processo} na {vara} — {empresa} (valor: {valor}).\n\nAtenciosamente.",
  min_score_for_outreach: 40,
} as const
