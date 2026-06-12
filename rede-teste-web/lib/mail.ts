export async function sendMail() {
  return { ok: false };
}

export async function sendReminderEmail(
  _to: string,
  _subject: string,
  _text: string,
): Promise<boolean> {
  return false;
}
