/**
 * Server-Sent Events helpers for the chatbot streaming path (Track 2).
 *
 * Pure encoders + the response header set, kept dependency-free so they are
 * trivially unit-testable and reusable by the assistant route's ReadableStream.
 * Mirrors the SSE wire format already used by
 * `app/api/tour-rooms/[bookingId]/events/route.ts`.
 */

const encoder = new TextEncoder();

/**
 * Encode a single named SSE event with a JSON `data:` payload.
 *
 * Produces `event: <name>\ndata: <json>\n\n` — the trailing blank line is the
 * event delimiter the client splits on.
 */
export function sseEvent(name: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`);
}

/**
 * Encode an SSE comment line (`: <text>\n\n`). Comments are ignored by SSE
 * clients but keep the connection warm and flush intermediary proxy buffers —
 * use as a heartbeat between long token gaps.
 */
export function sseComment(text: string): Uint8Array {
  return encoder.encode(`: ${text}\n\n`);
}

/**
 * SSE response headers (D-T2-6). `X-Accel-Buffering: no` disables Vercel/Nginx
 * response buffering so tokens stream in real time; `no-transform` stops
 * intermediaries from rewriting/compressing the stream.
 */
export const SSE_HEADERS: Record<string, string> = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};
