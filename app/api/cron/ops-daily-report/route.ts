import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { checkCronAuth } from '@/lib/cron-auth'
import { requireAdmin } from '@/lib/auth'
import { runDailyReport } from '@/lib/ops/report/send'
import { runAutopilot } from '@/lib/ops/autopilot/runner'
import { kstToday } from '@/lib/ops/guides/availability'

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
 *
 * ── 오토파일럿 점검 (관제 W5, 후속 §2-3) ────────────────────────────────────
 * 지금까지 제안 큐는 사람이 [지금 점검]을 눌러야만 생겼다. 큐에서 가장 값진
 * 항목이 "내일·모레 투어인데 안내가 안 나갔다"인데, 아무도 안 누르면 그 항목은
 * 투어가 지나간 뒤에 생긴다 — 그때는 제안이 아니라 사후 보고다.
 *
 * 주간 flywheel이 아니라 **이 일일 크론에 얹는다.** flywheel은 월 1회라
 * D+0~D+2만 보는 탐지를 주 6일 동안 낡은 채로 두게 된다. 여기서 돌리면 점검
 * 직후 그 결과가 같은 요청의 보고서 ⑤ 요주의에 그대로 실린다.
 *
 * 🔴 점검은 실행이 아니다. 만들어지는 것은 제안 행뿐이고 배정·배차·발송은
 * 하나도 하지 않는다(설계안 §1-7). 점검이 실패해도 보고서는 나간다.
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

    // 보고서보다 먼저 — 오늘 점검한 결과가 오늘 보고서의 요주의에 실려야 한다.
    // 실패는 삼키되 응답에 남긴다: 점검 하나 때문에 보고서를 못 받으면 안 된다.
    let autopilot: { found: number; created: number; updated: number } | { error: string }
    try {
      const run = await runAutopilot(supabase, { today: kstToday() })
      autopilot = { found: run.found, created: run.created, updated: run.updated }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('GET /api/cron/ops-daily-report autopilot scan failed:', message)
      autopilot = { error: message }
    }

    const result = await runDailyReport({ supabase, force })
    return NextResponse.json({ ...result, autopilot })
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
