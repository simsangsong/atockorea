import { NextResponse } from "next/server";

/**
 * TEMPORARY diagnostic route — 2026-07-04 production chatbot outage.
 *
 * Reports which GEMINI_API_KEY the running deployment actually loaded (first
 * 10 chars + length only; a Google API key prefix alone is not usable) plus a
 * live one-token probe against the Gemini API so we can distinguish
 * wrong-key / wrong-project / spend-cap states from the outside.
 *
 * DELETE this route once the outage is resolved.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const key = process.env.GEMINI_API_KEY ?? "";
  let probe: { status: number; error?: string } | { status: "no_key" };
  if (!key) {
    probe = { status: "no_key" };
  } else {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: "Say OK" }] }] }),
          cache: "no-store",
        },
      );
      let error: string | undefined;
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: { status?: string; message?: string } }
          | null;
        error = body?.error?.status ?? body?.error?.message?.slice(0, 120);
      }
      probe = { status: res.status, error };
    } catch (e) {
      probe = { status: 0, error: (e as Error).message.slice(0, 120) };
    }
  }
  return NextResponse.json({
    keyPrefix: key ? key.slice(0, 10) : null,
    keyLength: key.length,
    modelEnv: process.env.GEMINI_TOUR_PRODUCT_ASSISTANT_MODEL ?? null,
    probe,
    at: new Date().toISOString(),
  });
}
