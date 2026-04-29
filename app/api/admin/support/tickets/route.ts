/**
 * GET /api/admin/support/tickets — list tickets (newest first), optional ?status=
 * Service-role only (called from admin pages with admin auth).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sk = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !sk) throw new Error("Supabase admin env missing");
  return createClient(url, sk, { auth: { persistSession: false } });
}

export async function GET(req: NextRequest) {
  // TODO: Replace this guard with the project's admin-auth helper.
  // For now: require a static admin secret header (set ADMIN_SUPPORT_API_TOKEN).
  const requiredToken = process.env.ADMIN_SUPPORT_API_TOKEN;
  if (requiredToken) {
    const got = req.headers.get("x-admin-token");
    if (got !== requiredToken) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 200);

  const sb = adminClient();
  let q = sb
    .from("support_tickets")
    .select(
      "id, status, priority, escalation_reason, initial_summary, tour_slug, page_title, " +
        "user_locale, unread_for_admin, telegram_notified, created_at, updated_at"
    )
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (status) q = q.eq("status", status);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Counts
  const { count: openCount } = await sb
    .from("support_tickets")
    .select("id", { count: "exact", head: true })
    .eq("status", "open");
  const { count: unreadCount } = await sb
    .from("support_tickets")
    .select("id", { count: "exact", head: true })
    .eq("unread_for_admin", true);

  return NextResponse.json({
    tickets: data ?? [],
    counts: {
      open: openCount ?? 0,
      unread: unreadCount ?? 0,
    },
  });
}
