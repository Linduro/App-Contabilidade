/** Extrai hashtags e menções (@handle) do texto da publicação. */
export function parseJqContent(content: string) {
  const hashtags: string[] = [];
  const mentionHandles: string[] = [];

  const tagRe = /#([\p{L}\p{N}_]{2,50})/gu;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(content)) !== null) {
    hashtags.push(m[1].toLowerCase());
  }

  const mentionRe = /@([a-z0-9_]{2,30})/gi;
  while ((m = mentionRe.exec(content)) !== null) {
    mentionHandles.push(m[1].toLowerCase());
  }

  return {
    hashtags: [...new Set(hashtags)],
    mentionHandles: [...new Set(mentionHandles)],
  };
}
