import { ruleParse } from "./parser-rule";
import { haikuParse } from "./parser-haiku";
import type { ParsedQueryV2 } from "./types";

export type ParserMode = "haiku" | "rule" | "auto";

export async function parseQuery(query: string, mode: ParserMode = "auto"): Promise<ParsedQueryV2> {
  if (mode === "rule") return ruleParse(query);
  if (mode === "haiku") return haikuParse(query);
  // auto: prefer haiku if API key, fallback to rule
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      return await haikuParse(query);
    } catch (e) {
      console.warn("[tour-match-v2] Haiku parse failed, falling back to rule:", (e as Error).message);
      return ruleParse(query);
    }
  }
  return ruleParse(query);
}

export { ruleParse, haikuParse };
