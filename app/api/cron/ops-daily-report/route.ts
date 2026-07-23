import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { checkCronAuth } from '@/lib/cron-auth'
import { requireAdmin } from '@/lib/auth'
import { runDailyReport } from '@/lib/ops/report/send'

export const dynamic = 'force-dynamic'

/**
 * §11.E 매일 18:00 KST 일일 보고서 (每日報表).
 *
 * GET  — Vercel cron 진입점. vercel.json crons "0 9 * * *" (09:00 UTC = 18:00 KST).
 *        CRON_SECRET 인증(lib/cron-auth, Bearer 또는 X-Cron-Secret). 멱등:
 *        같은 날 이미 발송했으면 재발송하지 않는다. ?force=1 로 강제 재발송.
 * POST — admin [지금 보고서 발송] 원버튼(§11.E 수동 원버튼). requireAdmin,
 *        항상 force=true (같은 날 재발송 허용). 같은 runDailyReport 로직.
 *
 * 실제 발송은 lib/email.sendEmail(기존 Resend 경로 재사용). 수신자
 * OPS_REPORT_EMAIL || simsangsong@gmail.com.
 */

export async function GET(req: NextRequest) {
  try {
    const auth = checkCronAuth({
      authorization: req.headers.get('authorization'),
      xCronSecret: req.headers.get('x-cron-secret'),
    })
    if (auth === 'unconfigured') {
      return NextResponse.json({ error: 'Cron endpoint not configured' }, { status: 503 })
    }
    if (auth !== 'authorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const forceParam = req.nextUrl.searchParams.get('force')
    const force = forceParam === '1' || forceParam === 'true'

    const supabase = createServerClient()
    const result = await runDailyReport({ supabase, force })
    return NextResponse.json(result)
  } catch (error) {
    console.error('GET /api/cron/ops-daily-report error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req)
    const supabase = createServerClient()
    // 수동 원버튼은 항상 즉시 재발송 (force).
    const result = await runDailyReport({ supabase, force: true })
    return NextResponse.json(result)
  } catch (error: unknown) {
    if (error instanceof Error && (error.message === 'Unauthorized' || error.message.includes('Forbidden'))) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    console.error('POST /api/cron/ops-daily-report error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
