import { parseSseBuffer, type ParsedSseEvent } from "@/lib/chatbot/clientSse";

/**
 * Simulate arbitrary network chunking: feed the wire bytes split at every
 * index and assert the accumulate-then-split parser yields identical events
 * regardless of where the boundaries fall.
 */
function parseChunked(wire: string, chunkSizes: number[]): ParsedSseEvent[] {
  const events: ParsedSseEvent[] = [];
  let buffer = "";
  let offset = 0;
  for (const size of chunkSizes) {
    buffer += wire.slice(offset, offset + size);
    offset += size;
    const out = parseSseBuffer(buffer);
    buffer = out.rest;
    events.push(...out.events);
  }
  // Flush any trailing whole events.
  buffer += wire.slice(offset);
  const out = parseSseBuffer(buffer);
  events.push(...out.events);
  return events;
}

describe("parseSseBuffer", () => {
  it("parses a single complete event", () => {
    const { events, rest } = parseSseBuffer('event: delta\ndata: {"text":"hi"}\n\n');
    expect(rest).toBe("");
    expect(events).toEqual([{ event: "delta", data: '{"text":"hi"}' }]);
  });

  it("parses multiple events in one buffer", () => {
    const wire =
      'event: delta\ndata: {"text":"a"}\n\n' +
      'event: delta\ndata: {"text":"b"}\n\n' +
      'event: done\ndata: {"reply":"ab"}\n\n';
    const { events, rest } = parseSseBuffer(wire);
    expect(rest).toBe("");
    expect(events.map((e) => e.event)).toEqual(["delta", "delta", "done"]);
    expect(JSON.parse(events[2].data)).toEqual({ reply: "ab" });
  });

  it("buffers a partial trailing event and emits it once completed", () => {
    const first = parseSseBuffer('event: delta\ndata: {"text":"hi"}\n\nevent: do');
    expect(first.events).toHaveLength(1);
    expect(first.rest).toBe("event: do");

    const second = parseSseBuffer(first.rest + 'ne\ndata: {"reply":"hi"}\n\n');
    expect(second.events).toEqual([{ event: "done", data: '{"reply":"hi"}' }]);
    expect(second.rest).toBe("");
  });

  it("recovers the same events no matter where chunk boundaries fall", () => {
    const wire =
      'event: delta\ndata: {"text":"안녕"}\n\n' +
      'event: delta\ndata: {"text":" 제주"}\n\n' +
      'event: done\ndata: {"reply":"안녕 제주","handoff_offered":false}\n\n';

    const byteByByte = parseChunked(wire, Array(wire.length).fill(1));
    expect(byteByByte.map((e) => e.event)).toEqual(["delta", "delta", "done"]);
    expect(byteByByte.map((e) => JSON.parse(e.data).text ?? JSON.parse(e.data).reply)).toEqual([
      "안녕",
      " 제주",
      "안녕 제주",
    ]);

    const oddChunks = parseChunked(wire, [3, 7, 1, 20, 5, 11, 2]);
    expect(oddChunks).toEqual(byteByByte);
  });

  it("skips heartbeat/comment-only blocks", () => {
    const { events, rest } = parseSseBuffer(": heartbeat\n\nevent: delta\ndata: {\"text\":\"x\"}\n\n");
    expect(rest).toBe("");
    expect(events).toEqual([{ event: "delta", data: '{"text":"x"}' }]);
  });

  it("defaults the event name to 'message' when only data is present", () => {
    const { events } = parseSseBuffer("data: hello\n\n");
    expect(events).toEqual([{ event: "message", data: "hello" }]);
  });

  it("strips exactly one leading space after 'data:'", () => {
    const { events } = parseSseBuffer("data:  two-leading-spaces\n\n");
    expect(events[0].data).toBe(" two-leading-spaces");
  });
});
