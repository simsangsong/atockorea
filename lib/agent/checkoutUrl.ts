/**
 * Shared checkout-handoff URL builder for the agent channel.
 *
 * Both the REST `book` route and the MCP `create_booking` tool produce the same
 * deep link into the human hosted checkout, so the param contract lives in one
 * place. The agent never charges — this URL is where the traveller confirms and
 * pays.
 */

import type { AgentCatalogItem } from "@/lib/agent/catalog";

export interface CheckoutHandoffInput {
  date: string;
  guests: number;
  name?: string;
  email?: string;
  phone?: string;
}

export function buildCheckoutUrl(item: AgentCatalogItem, input: CheckoutHandoffInput): string {
  const url = new URL(item.url);
  url.searchParams.set("date", input.date);
  url.searchParams.set("guests", String(input.guests));
  if (input.name) url.searchParams.set("name", input.name);
  if (input.email) url.searchParams.set("email", input.email);
  if (input.phone) url.searchParams.set("phone", input.phone);
  url.searchParams.set("utm_source", "ai_agent");
  url.searchParams.set("utm_medium", "agent_channel");
  return url.toString();
}
