// Chat markdown-lite renderer (W4.0 / C-11) + URL safety helpers (W0.8 / C-35).
//
// The assistant writes `**bold**`, `[text](url)`, bullet/numbered lists, and
// bare URLs. The widget used to render all of it as plain text, so links were
// unclickable — the recommendation → product-page hop was impossible. This is
// a deliberate whitelist parser (no library, no dangerouslySetInnerHTML): only
// bold, lists, and validated links are interpreted; everything else stays
// literal text, so there is no HTML/script injection surface.

import type { ReactNode } from "react";

// ─── URL safety ──────────────────────────────────────────────────────────────

const INTERNAL_HOSTS = new Set(["atockorea.com", "www.atockorea.com"]);

/**
 * Validate a URL for rendering as a clickable link inside chat.
 * Allows root-relative paths ("/tour-product/…") and https URLs only.
 * Returns null for anything else (javascript:, data:, http:, malformed).
 */
export function safeChatHref(raw: string | null | undefined): { href: string; external: boolean } | null {
  if (!raw) return null;
  const url = raw.trim();
  if (/^\/(?!\/)/.test(url)) return { href: url, external: false };
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return null;
    return { href: u.toString(), external: !INTERNAL_HOSTS.has(u.hostname.toLowerCase()) };
  } catch {
    return null;
  }
}

/**
 * Stricter guard for the structured checkout button (C-35): the server only
 * ever sends a same-site relative path, so anything else is rejected outright.
 */
export function safeCheckoutUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const url = raw.trim();
  if (/^\/(?!\/)/.test(url)) return url;
  try {
    const u = new URL(url);
    if (u.protocol === "https:" && INTERNAL_HOSTS.has(u.hostname.toLowerCase())) {
      return u.pathname + u.search + u.hash;
    }
  } catch {
    /* not a URL */
  }
  return null;
}

// ─── Tokenizer (pure, unit-testable) ─────────────────────────────────────────

export type ChatInlineToken =
  | { type: "text"; text: string }
  | { type: "bold"; text: string }
  | { type: "link"; text: string; href: string; external: boolean };

export type ChatBlockToken =
  | { type: "paragraph"; children: ChatInlineToken[] }
  | { type: "list"; ordered: boolean; items: ChatInlineToken[][] };

// [text](url) — text without brackets, url without whitespace/closing paren.
const MD_LINK_RE = /\[([^\]\n]{1,200})\]\(([^\s()]{1,600})\)/g;
// Bare URLs: https://… or root-relative paths under known site prefixes (the
// prefix whitelist keeps things like "24/7" or "km/h" from linkifying).
const BARE_URL_RE =
  /(https:\/\/[^\s<>()[\]"']+|\/(?:tour-product|tours|itinerary-builder|checkout|about|support|contact|refund|terms|privacy)(?:\/[^\s<>()[\]"']*|\?[^\s<>()[\]"']*)?)/g;
const BOLD_RE = /\*\*([^*\n]+)\*\*/g;

/** Trim trailing punctuation a sentence glued onto a bare URL. */
function splitTrailingPunctuation(url: string): [string, string] {
  const m = url.match(/[.,;:!?)\]。、，！？』」）]+$/);
  if (!m) return [url, ""];
  return [url.slice(0, url.length - m[0].length), m[0]];
}

function pushText(out: ChatInlineToken[], text: string): void {
  if (!text) return;
  const last = out[out.length - 1];
  if (last && last.type === "text") last.text += text;
  else out.push({ type: "text", text });
}

/** Bold pass over a plain-text segment. */
function parseBold(out: ChatInlineToken[], text: string): void {
  let idx = 0;
  BOLD_RE.lastIndex = 0;
  for (let m = BOLD_RE.exec(text); m; m = BOLD_RE.exec(text)) {
    pushText(out, text.slice(idx, m.index));
    out.push({ type: "bold", text: m[1] });
    idx = m.index + m[0].length;
  }
  pushText(out, text.slice(idx));
}

/** Bare-URL pass (then bold inside the non-URL segments). */
function parseAutolinks(out: ChatInlineToken[], text: string): void {
  let idx = 0;
  BARE_URL_RE.lastIndex = 0;
  for (let m = BARE_URL_RE.exec(text); m; m = BARE_URL_RE.exec(text)) {
    parseBold(out, text.slice(idx, m.index));
    const [url, tail] = splitTrailingPunctuation(m[0]);
    const safe = safeChatHref(url);
    if (safe) out.push({ type: "link", text: url, href: safe.href, external: safe.external });
    else pushText(out, url);
    pushText(out, tail);
    idx = m.index + m[0].length;
  }
  parseBold(out, text.slice(idx));
}

/** Full inline parse: [text](url) links first, then bare URLs, then bold. */
export function parseChatInline(text: string): ChatInlineToken[] {
  const out: ChatInlineToken[] = [];
  let idx = 0;
  MD_LINK_RE.lastIndex = 0;
  for (let m = MD_LINK_RE.exec(text); m; m = MD_LINK_RE.exec(text)) {
    parseAutolinks(out, text.slice(idx, m.index));
    const safe = safeChatHref(m[2]);
    if (safe) out.push({ type: "link", text: m[1], href: safe.href, external: safe.external });
    else pushText(out, m[1]); // unsafe target → keep the label, drop the link
    idx = m.index + m[0].length;
  }
  parseAutolinks(out, text.slice(idx));
  return out;
}

const BULLET_LINE_RE = /^\s*[-*•]\s+(.*)$/;
const ORDERED_LINE_RE = /^\s*\d{1,2}[.)]\s+(.*)$/;

/** Block parse: group consecutive bullet/numbered lines into lists. */
export function parseChatMarkdown(text: string): ChatBlockToken[] {
  const blocks: ChatBlockToken[] = [];
  const lines = text.split("\n");
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: ChatInlineToken[][] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const joined = paragraph.join("\n").replace(/\n{3,}/g, "\n\n");
    if (joined.trim()) blocks.push({ type: "paragraph", children: parseChatInline(joined) });
    paragraph = [];
  };
  const flushList = () => {
    if (list) blocks.push({ type: "list", ordered: list.ordered, items: list.items });
    list = null;
  };

  for (const line of lines) {
    const bullet = line.match(BULLET_LINE_RE);
    const ordered = bullet ? null : line.match(ORDERED_LINE_RE);
    if (bullet || ordered) {
      flushParagraph();
      const isOrdered = Boolean(ordered);
      if (!list || list.ordered !== isOrdered) {
        flushList();
        list = { ordered: isOrdered, items: [] };
      }
      list.items.push(parseChatInline((bullet ?? ordered)![1]));
    } else {
      flushList();
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushList();
  return blocks;
}

// ─── Renderer ────────────────────────────────────────────────────────────────

function InlineNodes({ tokens }: { tokens: ChatInlineToken[] }) {
  return (
    <>
      {tokens.map((t, i) => {
        if (t.type === "bold") {
          return (
            <strong key={i} className="font-semibold text-slate-950">
              {t.text}
            </strong>
          );
        }
        if (t.type === "link") {
          return (
            <a
              key={i}
              href={t.href}
              {...(t.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="break-all font-semibold text-sky-800 underline decoration-sky-800/40 underline-offset-2 transition hover:text-sky-950 hover:decoration-sky-950/60"
            >
              {t.text}
            </a>
          );
        }
        return <span key={i}>{t.text}</span>;
      })}
    </>
  );
}

/** Assistant-bubble body: markdown-lite (bold / lists / safe links) render. */
export function ChatMarkdown({ text }: { text: string }) {
  const blocks = parseChatMarkdown(text);
  return (
    <span className="block break-words">
      {blocks.map((b, i) =>
        b.type === "paragraph" ? (
          <span key={i} className={`block whitespace-pre-wrap ${i > 0 ? "mt-1.5" : ""}`}>
            <InlineNodes tokens={b.children} />
          </span>
        ) : b.ordered ? (
          <ol key={i} className={`list-decimal space-y-1 pl-4 ${i > 0 ? "mt-1.5" : ""}`}>
            {b.items.map((item, j) => (
              <li key={j}>
                <InlineNodes tokens={item} />
              </li>
            ))}
          </ol>
        ) : (
          <ul key={i} className={`list-disc space-y-1 pl-4 ${i > 0 ? "mt-1.5" : ""}`}>
            {b.items.map((item, j) => (
              <li key={j}>
                <InlineNodes tokens={item} />
              </li>
            ))}
          </ul>
        ),
      )}
    </span>
  );
}
