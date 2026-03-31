/**
 * Splits editorial / CMS body copy for scan-friendly stacks.
 * Double newlines → paragraphs; long single blocks → ~2-sentence chunks (same heuristic as tour overview).
 */
export function toParagraphs(content: string): string[] {
  const normalized = content.replace(/\r\n/g, '\n').trim();
  const byNewline = normalized.split(/\n\s*\n/).filter((p) => p.trim());

  if (byNewline.length > 1) return byNewline;

  const single = byNewline[0] || normalized;
  if (single.length < 120) return [single];

  const sentences = single.split(/(?<=[.!?])\s+/).filter((s) => s.trim());
  if (sentences.length <= 1) return [single];

  const chunks: string[] = [];
  const sentencesPerParagraph = 2;
  for (let i = 0; i < sentences.length; i += sentencesPerParagraph) {
    chunks.push(sentences.slice(i, i + sentencesPerParagraph).join(' ').trim());
  }
  return chunks.filter(Boolean);
}
