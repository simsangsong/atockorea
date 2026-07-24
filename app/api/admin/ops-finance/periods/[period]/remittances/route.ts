import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { AdminAuthFailure, adminAuthJsonResponse, requireAdmin } from '@/lib/auth';
import { isMissingTableMessage } from '@/lib/ops/finance/ledger-view';
import {
  fetchPeriod,
  isValidPeriod,
  listRemittances,
  parseUsdToMinor,
  recordRemittance,
} from '@/lib/ops/finance/settlement';

export const dynamic = 'force-dynamic';

/**
 * 송금 기록 (§6.1 F-3, F-4).
 *
 *   GET  /api/admin/ops-finance/periods/[period]/remittances  → 목록
 *   POST .../remittances {wireDate, amountUsd, ...}           → 등록
 *
 * 🔴 국제송금 실행은 사람이 은행에서 한다(D10). 이 라우트는 이미 일어난 송금을
 *    받아 적을 뿐이고, 그 기록이 3자 대사의 세 번째 값이 된다.
 *    swiftDocUrl = 외화입금증명(영세율 첨부서류) 보관 위치(F-4).
 */

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ period: string }> },
) {
  try {
    await requireAdmin(req);
    const { period } = await ctx.params;
    if (!isValidPeriod(period)) {
      return NextResponse.json({ ok: false, message: 'invalid_period' }, { status: 400 });
    }
    const supabase = createServerClient();
    const periodRow = await fetchPeriod(supabase, period);
    if (!periodRow) return NextResponse.json({ ok: true, remittances: [] });
    const remittances = await listRemittances(supabase, periodRow.id);
    return NextResponse.json({ ok: true, remittances });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    if (e instanceof Error && isMissingTableMessage(e.message)) {
      return NextResponse.json({ ok: true, tableMissing: true, remittances: [] });
    }
    console.error('[ops-finance/remittances] GET error:', e);
    return NextResponse.json({ ok: false, message: 'internal_error' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ period: string }> },
) {
  try {
    await requireAdmin(req);
    const { period } = await ctx.params;
    if (!isValidPeriod(period)) {
      return NextResponse.json({ ok: false, message: 'invalid_period' }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      wireDate?: string;
      amountUsd?: string | number;
      amountKrw?: string | number;
      fxRate?: string | number;
      bankRef?: string;
      swiftDocUrl?: string;
      note?: string;
    };

    const wireDate = typeof body.wireDate === 'string' ? body.wireDate.trim() : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(wireDate)) {
      return NextResponse.json(
        { ok: false, message: 'wireDate는 YYYY-MM-DD 형식이어야 합니다.' },
        { status: 400 },
      );
    }

    const amountUsdMinor = parseUsdToMinor(body.amountUsd);
    if (amountUsdMinor === null) {
      return NextResponse.json(
        { ok: false, message: 'amountUsd는 0보다 큰 금액이어야 합니다.' },
        { status: 400 },
      );
    }

    const supabase = createServerClient();
    const periodRow = await fetchPeriod(supabase, period);
    if (!periodRow) {
      return NextResponse.json(
        { ok: false, message: '먼저 이 기간을 마감하세요.' },
        { status: 400 },
      );
    }

    const krwRaw = body.amountKrw;
    const amountKrw =
      krwRaw === undefined || krwRaw === null || krwRaw === ''
        ? null
        : Math.round(Number(String(krwRaw).replace(/[, ]/g, '')));
    const fxRaw = body.fxRate;
    const fxRate =
      fxRaw === undefined || fxRaw === null || fxRaw === '' ? null : Number(fxRaw);

    const row = await recordRemittance(supabase, periodRow, {
      wireDate,
      amountUsdMinor,
      amountKrw: Number.isFinite(amountKrw as number) ? amountKrw : null,
      fxRate: Number.isFinite(fxRate as number) ? fxRate : null,
      bankRef: typeof body.bankRef === 'string' && body.bankRef.trim() ? body.bankRef.trim() : null,
      swiftDocUrl:
        typeof body.swiftDocUrl === 'string' && body.swiftDocUrl.trim()
          ? body.swiftDocUrl.trim()
          : null,
      note: typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null,
    });

    return NextResponse.json({ ok: true, remittance: row, message: '송금 기록을 등록했습니다.' });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    if (e instanceof Error && isMissingTableMessage(e.message)) {
      return NextResponse.json(
        { ok: false, tableMissing: true, message: '정산 테이블이 아직 적용되지 않았습니다.' },
        { status: 503 },
      );
    }
    console.error('[ops-finance/remittances] POST error:', e);
    return NextResponse.json({ ok: false, message: 'internal_error' }, { status: 500 });
  }
}
