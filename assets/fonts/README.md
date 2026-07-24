# assets/fonts

Fonts bundled for **server-side PDF rendering** (`lib/ops/finance/pdf`). Not web
fonts — nothing here is served to the browser.

| File | Font | Licence |
| --- | --- | --- |
| `NotoSansKR-Regular.ttf` | Noto Sans KR 400 | SIL Open Font License 1.1 (`OFL.txt`) |
| `NotoSansKR-Bold.ttf` | Noto Sans KR 700 | SIL Open Font License 1.1 (`OFL.txt`) |

## Why they are committed

The settlement statement and the intercompany invoice are Korean documents
(labels, legal entity names, addresses, the `미입력` placeholder).
`@react-pdf/renderer`'s built-in Helvetica has no Hangul glyphs, so without a
registered Korean font every Korean character renders **blank** — a silent
corruption in a document that goes to an accountant or a bank.
`fonts.server.ts` therefore refuses to generate a PDF when these files are
missing rather than emitting a document with holes in it.

They are read from the filesystem at request time, so `next.config.js` names
them in `outputFileTracingIncludes` — otherwise the serverless bundle would ship
without them (nothing `import`s a `.ttf`, so the module tracer cannot find them).

Nanum Gothic was tried first (2 MB vs 6 MB per weight) but the Google Fonts TTF
build crashes fontkit's `glyf` parser inside react-pdf.
