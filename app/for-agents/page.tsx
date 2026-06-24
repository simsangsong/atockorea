import type { Metadata } from "next";

/**
 * /for-agents — human + machine readable guide to the AtoC Korea agent channel.
 *
 * A trust surface: it tells agent developers (and the agents themselves) exactly
 * how discovery → quote → checkout-handoff works, and that no card is ever
 * charged by the agent. Kept dependency-free (plain server component) so it
 * renders without JS for crawlers.
 */

function siteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://www.atockorea.com";
  const normalized = raw.replace(/\/+$/, "");
  return normalized === "https://atockorea.com" ? "https://www.atockorea.com" : normalized;
}

export const metadata: Metadata = {
  title: "For AI Agents — AtoC Korea",
  description:
    "Open AI-agent channel for AtoC Korea: discover Korea tours, get signed price quotes, and hand travellers to hosted checkout. Agents never charge cards.",
  alternates: { canonical: "/for-agents" },
  robots: { index: true, follow: true },
};

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[0.9em] text-neutral-800">
      {children}
    </code>
  );
}

export default function ForAgentsPage() {
  const base = siteUrl();

  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-neutral-800">
      <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">
        AtoC Korea — AI Agent Channel
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-neutral-600">
        An open, machine-readable channel for AI assistants to discover Korea
        private &amp; small-group tours, fetch deterministic prices, and complete
        a booking on the traveller&apos;s behalf — up to the payment step.
        Agents never charge cards; the traveller confirms and pays at our hosted
        checkout.
      </p>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-neutral-900">Start here</h2>
        <ul className="mt-3 space-y-2">
          <li>
            <strong>OpenAPI 3.1 contract:</strong>{" "}
            <a className="text-amber-700 underline" href={`${base}/api/agent/openapi.json`}>
              /api/agent/openapi.json
            </a>
          </li>
          <li>
            <strong>llms.txt:</strong>{" "}
            <a className="text-amber-700 underline" href={`${base}/llms.txt`}>
              /llms.txt
            </a>
          </li>
          <li>
            <strong>Tour catalogue (JSON):</strong>{" "}
            <a className="text-amber-700 underline" href={`${base}/api/agent/v1/tours`}>
              /api/agent/v1/tours
            </a>
          </li>
          <li>
            <strong>MCP server (Streamable HTTP):</strong>{" "}
            <Code>{`${base}/api/agent/mcp`}</Code>
          </li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-neutral-900">MCP (for assistants that speak it)</h2>
        <p className="mt-3 leading-relaxed text-neutral-600">
          Connect an MCP client to <Code>/api/agent/mcp</Code> (Model Context
          Protocol over Streamable HTTP). Tools: <Code>search_tours</Code>,{" "}
          <Code>get_tour</Code>, <Code>quote_price</Code>, and{" "}
          <Code>create_booking</Code>. Same guarantees as the REST channel —
          signed prices, and <Code>create_booking</Code> returns a hosted
          checkout URL the traveller pays. No card is charged by the agent.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-neutral-900">The flow</h2>
        <ol className="mt-3 list-decimal space-y-3 pl-5">
          <li>
            <strong>Discover</strong> — <Code>GET /api/agent/v1/tours?region=jeju&amp;search=unesco</Code>{" "}
            returns the catalogue. One tour: <Code>GET /api/agent/v1/tours/&#123;slug&#125;</Code>.
          </li>
          <li>
            <strong>Quote</strong> — <Code>POST /api/agent/v1/quote</Code> with{" "}
            <Code>&#123; slug, date, guests &#125;</Code>. You get a price and a{" "}
            <Code>quote_token</Code> (HMAC-signed, valid 15 min). Prices are
            server-authoritative and deterministic — you cannot invent them.
          </li>
          <li>
            <strong>Book</strong> — <Code>POST /api/agent/v1/book</Code> with{" "}
            <Code>&#123; quote_token, contact? &#125;</Code>. You receive a{" "}
            <Code>checkout_url</Code>. Hand it to the traveller; they review and
            pay on our hosted checkout.
          </li>
        </ol>
      </section>

      <section className="mt-10 rounded-xl border border-amber-200 bg-amber-50 p-5">
        <h2 className="text-lg font-semibold text-neutral-900">Trust guarantees</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-neutral-700">
          <li>No card is ever charged by an agent — payment is human-confirmed.</li>
          <li>Prices are deterministic and signed; the booking step rejects altered or expired quotes.</li>
          <li>Out-of-scope requests fail loudly (e.g. party too large) with a contact path, never a silent wrong booking.</li>
          <li>Read and quote endpoints need no auth or API key. CORS-open for browser-based agents.</li>
        </ul>
      </section>

      <p className="mt-10 text-sm text-neutral-500">
        Questions or want a higher rate limit / API key tier?{" "}
        <a className="text-amber-700 underline" href="mailto:contact@atockorea.com">
          contact@atockorea.com
        </a>
      </p>
    </main>
  );
}
