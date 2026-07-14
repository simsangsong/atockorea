import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * W6.1 — ops-console Web Push subscription registry (admin-only).
 *
 * POST { subscription: PushSubscriptionJSON }  → upsert by endpoint
 * DELETE { endpoint }                          → remove this device
 *
 * Rows are service-role only (RLS, no policies); the endpoint is a capability
 * URL so it never leaves the server after registration.
 */

interface SubscriptionBody {
  subscription?: {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    const body = (await req.json().catch(() => ({}))) as SubscriptionBody;
    const endpoint = body.subscription?.endpoint;
    const p256dh = body.subscription?.keys?.p256dh;
    const auth = body.subscription?.keys?.auth;
    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
    }

    const supabase = createServerClient();
    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: admin.id,
        role: 'admin',
        endpoint,
        p256dh,
        auth,
        user_agent: req.headers.get('user-agent')?.slice(0, 300) ?? null,
      },
      { onConflict: 'endpoint' },
    );
    if (error) throw error;
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Error && (error.message === 'Unauthorized' || error.message.includes('Forbidden'))) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    console.error('POST /api/admin/tour-ops/push-subscriptions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireAdmin(req);
    const body = (await req.json().catch(() => ({}))) as { endpoint?: string };
    if (!body.endpoint) {
      return NextResponse.json({ error: 'endpoint required' }, { status: 400 });
    }
    const supabase = createServerClient();
    const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', body.endpoint);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    if (error instanceof Error && (error.message === 'Unauthorized' || error.message.includes('Forbidden'))) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    console.error('DELETE /api/admin/tour-ops/push-subscriptions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
