import type { VideoLanguageCode } from '@/lib/video-automation/languages';
import { formatSrtTime, formatVttTime } from '@/lib/video-automation/subtitles';

export interface SubtitleCue {
  start: number;
  end: number;
  text: string;
}

const CJK_PATTERN = /[぀-ヿ㐀-䶿一-鿿豈-﫿]/;

function maxCueChars(text: string, language: VideoLanguageCode): number {
  const cjk = language === 'ja' || language === 'zh-Hant' || CJK_PATTERN.test(text);
  return cjk ? 28 : 60;
}

function splitKeeping(text: string, pattern: RegExp): string[] {
  return text
    .split(pattern)
    .map((part) => part.trim())
    .filter(Boolean);
}

function hardWrap(piece: string, maxLen: number): string[] {
  if (piece.length <= maxLen) return [piece];
  const words = piece.split(/\s+/).filter(Boolean);
  if (words.length <= 1) {
    const out: string[] = [];
    for (let index = 0; index < piece.length; index += maxLen) out.push(piece.slice(index, index + maxLen));
    return out;
  }
  const out: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxLen || !current) {
      current = candidate;
    } else {
      out.push(current);
      current = word;
    }
  }
  if (current) out.push(current);
  return out;
}

/**
 * Splits one scene's narration into display-sized subtitle chunks (≤ ~2 lines):
 * sentence breaks first, then clause breaks, then word/char wrapping, greedily
 * repacked up to the per-language budget.
 */
export function chunkNarration(text: string, language: VideoLanguageCode): string[] {
  const clean = text.trim();
  if (!clean) return [];
  const maxLen = maxCueChars(clean, language);
  if (clean.length <= maxLen) return [clean];

  const pieces = splitKeeping(clean, /(?<=[。！？!?])\s*/)
    .flatMap((sentence) =>
      sentence.length <= maxLen ? [sentence] : splitKeeping(sentence, /(?<=[、，,;；—·])\s*/),
    )
    .flatMap((piece) => hardWrap(piece, maxLen));

  const chunks: string[] = [];
  let current = '';
  for (const piece of pieces) {
    const joiner = current && !CJK_PATTERN.test(current.slice(-1)) ? ' ' : '';
    const candidate = current ? `${current}${joiner}${piece}` : piece;
    if (candidate.length <= maxLen || !current) {
      current = candidate;
    } else {
      chunks.push(current);
      current = piece;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/**
 * Lays scene chunks sequentially across the scene's subtitle window, with time
 * proportional to chunk length and a floor so short cues stay readable.
 */
export function cuesForScene(
  text: string,
  language: VideoLanguageCode,
  windowStart: number,
  windowEnd: number,
): SubtitleCue[] {
  const chunks = chunkNarration(text, language);
  if (chunks.length === 0) return [];
  const window = Math.max(0.5, windowEnd - windowStart);
  const totalChars = chunks.reduce((acc, chunk) => acc + chunk.length, 0);

  let durations = chunks.map((chunk) => Math.max(0.9, window * (chunk.length / totalChars)));
  const sum = durations.reduce((acc, duration) => acc + duration, 0);
  if (sum > window) durations = durations.map((duration) => (duration * window) / sum);

  const cues: SubtitleCue[] = [];
  let cursor = windowStart;
  for (const [index, chunk] of chunks.entries()) {
    const end = index === chunks.length - 1 ? windowEnd : Math.min(windowEnd, cursor + durations[index]);
    cues.push({ start: Math.round(cursor * 1000) / 1000, end: Math.round(end * 1000) / 1000, text: chunk });
    cursor = end;
  }
  return cues;
}

export function cuesToVtt(cues: SubtitleCue[]): string {
  const blocks = cues.map(
    (cue, index) => `${index + 1}\n${formatVttTime(cue.start)} --> ${formatVttTime(cue.end)}\n${cue.text}`,
  );
  return ['WEBVTT', ...blocks].join('\n\n') + '\n';
}

export function cuesToSrt(cues: SubtitleCue[]): string {
  const blocks = cues.map(
    (cue, index) => `${index + 1}\n${formatSrtTime(cue.start)} --> ${formatSrtTime(cue.end)}\n${cue.text}`,
  );
  return blocks.join('\n\n') + '\n';
}
