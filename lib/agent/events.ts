/**
 * Best-effort telemetry for the agent channel.
 *
 * Writes to `public.agent_channel_events` (see
 * supabase/pending-db-apply/2026-06-24-09-agent-channel-events.sql) so we can
 * measure who discovers us and how the quote → booking funnel performs.
 *
 * Never throws and never blocks the caller's result: if the table is absent
 * (SQL not applied) or the write fails, we swallow it. Telemetry is a bonus,
 * never a gate. We store the bot User-Agent but never the raw client IP.
 */

import { createServerClient } from "@/lib/supabase";

export type AgentEventType =
  | "tour_viewed"
  | "catalog_searched"
  | "quote_issued"
  | "availability_checked"
  | "booking_handoff"
  | "mcp_tool_call";

export interface AgentEventInput {
  eventType: AgentEventType;
  channel: "rest" | "mcp";
  slug?: string | null;
  tourDate?: string | null;
  guests?: number | null;
  apiKeyLabel?: string | null;
  userAgent?: string | null;
  props?: Record<string, unknown>;
}

export async function logAgentEvent(input: AgentEventInput): Promise<void> {
  try {
    const supabase = createServerClient();
    await supabase.from("agent_channel_events").insert({
      event_type: input.eventType,
      channel: input.channel,
      slug: input.slug ?? null,
      tour_date: input.tourDate ?? null,
      guests: input.guests ?? null,
      api_key_label: input.apiKeyLabel ?? null,
      user_agent: input.userAgent ? input.userAgent.slice(0, 512) : null,
      props: input.props ?? {},
    });
  } catch {
    // Table missing / client unavailable — telemetry is non-critical.
  }
}

/** Convenience: pull a trimmed User-Agent from a request. */
export function userAgentOf(req: Request): string | null {
  return req.headers.get("user-agent");
}
