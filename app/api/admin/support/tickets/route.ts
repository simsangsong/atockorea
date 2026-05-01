/**
 * GET /api/admin/support/tickets — list tickets (newest first), optional ?status=
 *
 * Auth: Supabase admin session via requireAdmin().
 * The previous static-token guard is removed because the `if (!requiredToken)` branch
 * effectively allowed anonymous access whenever ADMIN_SUPPORT_API_TOKEN was unset.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminAuthFailure, adminAuthJsonResponse } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const limit = Math.min(Number(searchParams.get("limit") ?? 50), 200);

    const sb = createServerClient();
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
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    console.error("[GET /api/admin/support/tickets] error:", e);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
