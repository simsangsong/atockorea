'use client';

/**
 * Renders tour full description with consistent font, line-height, and paragraph breaks.
 * If the source has no line breaks, splits by sentences into 2–3 sentence paragraphs for readability.
 */
function toParagraphs(content: string): string[] {
  const normalized = content.replace(/\r\n/g, '\n').trim();
  const byNewline = normalized.split(/\n\s*\n/).filter((p) => p.trim());

  // Already multiple paragraphs from source
  if (byNewline.length > 1) return byNewline;

  const single = byNewline[0] || normalized;
  // One long block with no newlines → break by sentences into ~2–3 sentence chunks
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

export default function TourOverviewContent({ content }: { content: string }) {
  if (!content || !content.trim()) return null;

  const paragraphs = toParagraphs(content);

  return (
    <div className="tour-overview max-w-[65ch] text-[15px] sm:text-base text-gray-700 leading-[1.8] tracking-wide antialiased [font-family:var(--font-inter),system-ui,sans-serif]">
      {paragraphs.map((paragraph, i) => (
        <p key={i} className="mb-5 last:mb-0">
          {paragraph.split(/\n/).map((line, j) => (
            <span key={j}>
              {j > 0 && <br />}
              {line.trim()}
            </span>
          ))}
        </p>
      ))}
    </div>
  );
}
