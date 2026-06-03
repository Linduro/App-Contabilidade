export const WELCOME_GREETING_SESSION_KEY = "advforte-show-welcome"

export function getWelcomeGreeting(date = new Date()): string {
  const hour = date.getHours()

  if (hour >= 6 && hour < 12) return "Bom Dia"
  if (hour >= 12 && hour < 18) return "Boa Tarde"
  return "Boa Noite"
}
