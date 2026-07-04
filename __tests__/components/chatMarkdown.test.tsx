import {
  parseChatInline,
  parseChatMarkdown,
  safeChatHref,
  safeCheckoutUrl,
} from "@/components/product-tour-static/_shared/chatMarkdown";

describe("safeChatHref (W0.8 / C-35)", () => {
  it("allows root-relative paths and https URLs", () => {
    expect(safeChatHref("/tour-product/jeju-private")).toEqual({
      href: "/tour-product/jeju-private",
      external: false,
    });
    expect(safeChatHref("https://www.atockorea.com/tours/list")?.external).toBe(false);
    expect(safeChatHref("https://example.com/x")?.external).toBe(true);
  });

  it("rejects javascript:, data:, http:, protocol-relative, and garbage", () => {
    expect(safeChatHref("javascript:alert(1)")).toBeNull();
    expect(safeChatHref("data:text/html,<script>")).toBeNull();
    expect(safeChatHref("http://insecure.com")).toBeNull();
    expect(safeChatHref("//evil.com/path")).toBeNull();
    expect(safeChatHref("not a url")).toBeNull();
    expect(safeChatHref(null)).toBeNull();
  });
});

describe("safeCheckoutUrl", () => {
  it("allows relative checkout paths", () => {
    expect(safeCheckoutUrl("/itinerary-builder/checkout?bookingId=abc")).toBe(
      "/itinerary-builder/checkout?bookingId=abc",
    );
  });

  it("normalizes same-site absolute URLs to a path", () => {
    expect(safeCheckoutUrl("https://www.atockorea.com/checkout?x=1")).toBe("/checkout?x=1");
  });

  it("rejects external and unsafe URLs", () => {
    expect(safeCheckoutUrl("https://evil.com/checkout")).toBeNull();
    expect(safeCheckoutUrl("javascript:alert(1)")).toBeNull();
    expect(safeCheckoutUrl(undefined)).toBeNull();
  });
});

describe("parseChatInline (W4.0 / C-11)", () => {
  it("parses **bold**", () => {
    expect(parseChatInline("a **b** c")).toEqual([
      { type: "text", text: "a " },
      { type: "bold", text: "b" },
      { type: "text", text: " c" },
    ]);
  });

  it("parses [text](url) links with safety validation", () => {
    const tokens = parseChatInline("See [Jeju tour](/tour-product/jeju-east) now");
    expect(tokens).toEqual([
      { type: "text", text: "See " },
      { type: "link", text: "Jeju tour", href: "/tour-product/jeju-east", external: false },
      { type: "text", text: " now" },
    ]);
  });

  it("keeps the label but drops the link for unsafe targets", () => {
    // Paren-free unsafe scheme → parsed, then rejected by safeChatHref.
    expect(parseChatInline("[click](javascript:void0)")).toEqual([
      { type: "text", text: "click" },
    ]);
    // Parens in the href don't even parse as a link → stays literal (safe).
    expect(parseChatInline("[click](javascript:alert(1))")).toEqual([
      { type: "text", text: "[click](javascript:alert(1))" },
    ]);
  });

  it("autolinks bare https URLs and internal paths, trimming punctuation", () => {
    const tokens = parseChatInline("Details: https://www.atockorea.com/tour-product/x.");
    expect(tokens[1]).toMatchObject({ type: "link", external: false });
    expect(tokens[2]).toEqual({ type: "text", text: "." });

    const path = parseChatInline("체크아웃: /itinerary-builder/checkout?bookingId=abc 입니다");
    const link = path.find((t) => t.type === "link");
    expect(link).toMatchObject({ href: "/itinerary-builder/checkout?bookingId=abc" });
  });

  it("does not linkify plain text like 24/7 or fractions", () => {
    expect(parseChatInline("We run 24/7 support")).toEqual([
      { type: "text", text: "We run 24/7 support" },
    ]);
  });

  it("parses bold inside non-link segments alongside links", () => {
    const tokens = parseChatInline("**Price:** ₩250,000 — [book](/checkout?b=1)");
    expect(tokens[0]).toEqual({ type: "bold", text: "Price:" });
    expect(tokens.find((t) => t.type === "link")).toBeTruthy();
  });
});

describe("parseChatMarkdown blocks", () => {
  it("groups bullet lines into an unordered list", () => {
    const blocks = parseChatMarkdown("Intro:\n- one\n- two\nOutro");
    expect(blocks.map((b) => b.type)).toEqual(["paragraph", "list", "paragraph"]);
    const list = blocks[1] as Extract<(typeof blocks)[number], { type: "list" }>;
    expect(list.ordered).toBe(false);
    expect(list.items).toHaveLength(2);
  });

  it("groups numbered lines into an ordered list (catalogue reply shape)", () => {
    const blocks = parseChatMarkdown(
      "These tours match:\n1. Jeju East · /tour-product/jeju-east\n2. Jeju West · /tour-product/jeju-west",
    );
    const list = blocks[1] as Extract<(typeof blocks)[number], { type: "list" }>;
    expect(list.ordered).toBe(true);
    expect(list.items[0].some((t) => t.type === "link")).toBe(true);
  });

  it("keeps plain multi-line text as a single paragraph", () => {
    const blocks = parseChatMarkdown("line one\nline two");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("paragraph");
  });
});
