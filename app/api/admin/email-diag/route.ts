/**
 * Email + Auth diagnostic endpoint (admin only).
 *
 * GET  /api/admin/email-diag                       — config status snapshot
 * POST /api/admin/email-diag {to, mode}            — send a test email
 *
 * Auth: Supabase admin session via requireAdmin().
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireAdmin, AdminAuthFailure, adminAuthJsonResponse } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function snapshot() {
  return {
    resend_configured: !!process.env.RESEND_API_KEY,
    resend_from: process.env.RESEND_FROM_EMAIL ?? "AtoCKorea <support@atockorea.com>",
    supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? null,
    supabase_anon_key_set: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    supabase_service_role_set: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    anthropic_set: !!process.env.ANTHROPIC_API_KEY,
    gemini_set: !!process.env.GEMINI_API_KEY,
    telegram_set: !!process.env.TELEGRAM_BOT_TOKEN,
    next_public_app_url: process.env.NEXT_PUBLIC_APP_URL ?? null,
    notes: [
      "Verification emails sent during signup go through SUPABASE Auth, not via our direct Resend client.",
      "Supabase Auth uses its DEFAULT SMTP unless you configure a custom one in:",
      "  Supabase Dashboard → Project Settings → Auth → SMTP Settings → Enable Custom SMTP",
      "Default Supabase SMTP is rate-limited (~4/hour) and may be hidden from end users.",
      "If signup OTPs are not arriving: most likely cause is Supabase SMTP not pointed to Resend.",
    ],
  };
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    return NextResponse.json(snapshot());
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    console.error("[GET /api/admin/email-diag] error:", e);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

const postSchema = z.object({
  to: z.string().email(),
  mode: z.enum(["resend_direct", "supabase_otp"]).default("resend_direct"),
});

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);

    const json = await req.json().catch(() => null);
    const parsed = postSchema.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    const { to, mode } = parsed.data;

    if (mode === "resend_direct") {
      if (!process.env.RESEND_API_KEY) {
        return NextResponse.json(
          {
            ok: false,
            mode,
            error: "RESEND_API_KEY not set in environment",
          },
          { status: 500 }
        );
      }
      try {
        const { Resend } = await import("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);
        const t0 = Date.now();
        const { data, error } = await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL ?? "AtoCKorea <support@atockorea.com>",
          to,
          subject: "[AtoC Korea] Email diagnostic test",
          html: `<div style="font-family: system-ui; padding: 24px;">
            <h2 style="margin: 0 0 12px;">Resend direct test</h2>
            <p>This message was sent via our Resend API key directly (bypassing Supabase Auth).</p>
            <p>If this arrives but signup OTP emails do NOT, the problem is in
               <strong>Supabase Dashboard → Auth → SMTP Settings</strong>.</p>
            <p style="color: #888; font-size: 12px;">Sent: ${new Date().toISOString()}</p>
          </div>`,
        });
        const elapsed_ms = Date.now() - t0;
        if (error) {
          return NextResponse.json(
            { ok: false, mode, error: error.message, elapsed_ms },
            { status: 502 }
          );
        }
        return NextResponse.json({ ok: true, mode, message_id: data?.id, elapsed_ms });
      } catch (err) {
        return NextResponse.json(
          { ok: false, mode, error: (err as Error).message },
          { status: 500 }
        );
      }
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) {
      return NextResponse.json({ ok: false, mode, error: "Supabase env missing" }, { status: 500 });
    }
    const sb = createClient(url, anon, { auth: { persistSession: false } });
    const t0 = Date.now();
    const { error } = await sb.auth.signInWithOtp({
      email: to,
      options: { shouldCreateUser: false },
    });
    const elapsed_ms = Date.now() - t0;
    if (error) {
      return NextResponse.json(
        { ok: false, mode, error: error.message, elapsed_ms },
        { status: 502 }
      );
    }
    return NextResponse.json({
      ok: true,
      mode,
      elapsed_ms,
      note: "Supabase accepted the request. Check Resend dashboard logs (if Supabase SMTP is Resend) or Supabase logs to verify actual delivery. If no email arrives, the SMTP route inside Supabase is broken — see Dashboard → Auth → SMTP Settings.",
    });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    console.error("[POST /api/admin/email-diag] error:", e);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
