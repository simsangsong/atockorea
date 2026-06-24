/**
 * Browser-side SSE parser for the chatbot streaming path (Track 2).
 *
 * Network chunks from `ReadableStream.getReader()` do NOT align with SSE event
 * boundaries — a single read can split an event mid-line, or carry several
 * events at once. The consumer must therefore accumulate bytes into a buffer
 * and split on the blank-line delimiter (`\n\n`), keeping the trailing partial
 * event for the next chunk. `parseSseBuffer` does exactly that.
 */

export type ParsedSseEvent = {
  /** The `event:` name; defaults to "message" per the SSE spec when omitted. */
  event: string;
  /** The joined `data:` payload (multiple data lines joined by "\n"). */
  data: string;
};

/**
 * Split an accumulated SSE buffer into complete events plus the leftover
 * remainder (a partial event still arriving). The caller MUST keep `rest` and
 * prepend it to the next chunk before calling again.
 *
 * Comment/heartbeat blocks (only `:`-prefixed lines, no `data:`) are skipped.
 */
export function parseSseBuffer(buffer: string): { events: ParsedSseEvent[]; rest: string } {
  // Tolerate CRLF line endings (SSE spec allows them); our server emits "\n".
  let rest = buffer.replace(/\r\n/g, "\n");
  const events: ParsedSseEvent[] = [];

  let delimiter = rest.indexOf("\n\n");
  while (delimiter !== -1) {
    const block = rest.slice(0, delimiter);
    rest = rest.slice(delimiter + 2);
    const parsed = parseEventBlock(block);
    if (parsed) events.push(parsed);
    delimiter = rest.indexOf("\n\n");
  }

  return { events, rest };
}

function parseEventBlock(block: string): ParsedSseEvent | null {
  let event = "message";
  const dataLines: string[] = [];

  for (const line of block.split("\n")) {
    if (line === "" || line.startsWith(":")) continue; // blank or comment/heartbeat
    if (line.startsWith("event:")) {
      event = line.slice(6).trimStart();
    } else if (line.startsWith("data:")) {
      // Per the SSE spec, strip exactly one optional leading space.
      const value = line.slice(5);
      dataLines.push(value.startsWith(" ") ? value.slice(1) : value);
    }
  }

  if (dataLines.length === 0) return null; // no data → heartbeat/comment only
  return { event: event.trim(), data: dataLines.join("\n") };
}
