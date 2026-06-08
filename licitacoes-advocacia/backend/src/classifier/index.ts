// Classificador integrado ao job collectAndMatch
export async function runClassifier(): Promise<void> {
  const { runCollectAndMatch } = await import("../jobs/collectAndMatch.js");
  await runCollectAndMatch();
}
