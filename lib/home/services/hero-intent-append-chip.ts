/**
 * Legacy hero “quick tag” append: comma-separated, de-dupes if phrase already appears in the field.
 */
export function appendIntentPhraseToIntentField(currentIntent: string, phrase: string): string {
  const p = currentIntent.trim();
  if (!p) return phrase;
  if (p.includes(phrase)) return p;
  return `${p}, ${phrase}`;
}
