import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { AdminAuthFailure, adminAuthJsonResponse, requireAdmin } from '@/lib/auth';
import { buildInvoiceDoc, buildStatementDoc } from '@/lib/ops/finance/documents';
import { isMissingTableMessage } from '@/lib/ops/finance/ledger-view';
import { loadPeriodDetail } from '@/lib/ops/finance/periodDetail';
import {
  financeDocSignedUrl,
  generateInvoicePdf,
  generateStatementPdf,
  type FinanceDocStorageClient,
} from '@/lib/ops/finance/pdf/storage.server';
import type { FinanceDocKind } from '@/lib/ops/finance/pdf/paths';
import { isValidPeriod } from '@/lib/ops/finance/settlement';

export const dynamic = 'force-dynamic';
// @react-pdf renders with node APIs and reads the font files from disk.
export const runtime = 'nodejs';

/**
 * 정산 문서 PDF (§6.3, 감사 G2 해소).
 *
 *   POST /api/admin/ops-finance/periods/[period]/pdf  { kind: 'statement' | 'invoice' }
 *     → private 버킷에 PDF 생성·보관 + 경로를 DB에 기록 + 단기 서명 URL 반환
 *   GET  /api/admin/ops-finance/periods/[period]/pdf?kind=statement|invoice
 *     → 이미 보관된 문서의 새 서명 URL (없으면 path=null)
 *
 * 숫자는 화면·인쇄 뷰와 **같은 buildStatementDoc/buildInvoiceDoc 결과**에서 나온다.
 * 이 라우트는 문서 모델을 다시 계산하지 않는다.
 *
 * 🔴 D10 — 생성하고 보관할 뿐이다. 어디에도 제출·발송하지 않는다.
 * 🔴 DRAFT — ops_finance_config.expert_reviewed가 true가 아니면 워터마크가 찍힌
 *    문서만 나온다. 그 판정도 documents.ts 한 곳에서만 한다.
 */

const KINDS = new Set<FinanceDocKind>(['statement', 'invoice']);

function parseKind(value: unknown): FinanceDocKind | null {
  return typeof value === 'string' && KINDS.has(value as FinanceDocKind)
    ? (value as FinanceDocKind)
    : null;
}

/**
 * `statement_pdf_path` is read on its own rather than added to settlement.ts's
 * explicit PERIOD_COLS: naming a not-yet-migrated column there would fail the
 * whole period lookup and take the finance screens down with it (the same trap
 * config.ts documents for expert_reviewed).
 */
async function fetchStatementPdfPath(
  supabase: ReturnType<typeof createServerClient>,
  periodId: string,
): Promise<string | null> {
  try {
    const { data } = await supabase
      .from('ops_settlement_periods')
      .select('statement_pdf_path')
      .eq('id', periodId)
      .maybeSingle();
    return ((data as { statement_pdf_path?: string | null } | null)?.statement_pdf_path) ?? null;
  } catch {
    return null;
  }
}

function isMissingColumn(message: string): boolean {
  return /column .* does not exist|could not find the .* column/i.test(message);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ period: string }> }) {
  try {
    await requireAdmin(req);
    const { period } = await ctx.params;
    if (!isValidPeriod(period)) {
      return NextResponse.json({ ok: false, message: 'invalid_period' }, { status: 400 });
    }
    const body = (await req.json().catch(() => ({}))) as { kind?: unknown };
    const kind = parseKind(body.kind);
    if (!kind) {
      return NextResponse.json({ ok: false, message: 'kind must be statement or invoice' }, { status: 400 });
    }

    const supabase = createServerClient();
    const detail = await loadPeriodDetail(supabase, period);
    if (!detail.period) {
      return NextResponse.json({ ok: false, message: '먼저 이 기간을 마감하세요.' }, { status: 400 });
    }
    if (kind === 'invoice' && !detail.invoice) {
      return NextResponse.json(
        { ok: false, message: '이 기간에는 아직 발행된 인보이스가 없습니다.' },
        { status: 400 },
      );
    }

    const storage = supabase as unknown as FinanceDocStorageClient;
    const shared = {
      period: detail.period,
      config: detail.config,
      ledgerRows: detail.ledgerRows,
      bookingMeta: detail.bookingMeta,
      invoice: detail.invoice,
      remittances: detail.remittances,
    };

    if (kind === 'statement') {
      const stored = await generateStatementPdf(storage, buildStatementDoc(shared));
      const { error } = await supabase
        .from('ops_settlement_periods')
        .update({
          statement_pdf_path: stored.path,
          statement_pdf_generated_at: stored.generatedAt,
          updated_at: stored.generatedAt,
        })
        .eq('id', detail.period.id);
      if (error) {
        // The PDF exists in storage either way; only the pointer failed.
        if (isMissingColumn(error.message)) {
          return NextResponse.json(
            {
              ok: true,
              ...stored,
              recorded: false,
              message:
                'PDF는 보관됐지만 경로를 기록하지 못했습니다 — statement_pdf_path 마이그레이션을 적용하세요.',
            },
            { status: 200 },
          );
        }
        throw new Error(error.message);
      }
      return NextResponse.json({ ok: true, recorded: true, ...stored });
    }

    const stored = await generateInvoicePdf(
      storage,
      buildInvoiceDoc({ ...shared, invoice: detail.invoice! }),
    );
    const { error } = await supabase
      .from('ops_intercompany_invoices')
      .update({
        // private 버킷 객체 경로다(공개 URL 아님) — 조회는 서명 URL로만.
        pdf_url: stored.path,
        pdf_generated_at: stored.generatedAt,
        updated_at: stored.generatedAt,
      })
      .eq('id', detail.invoice!.id);
    if (error) {
      if (isMissingColumn(error.message)) {
        return NextResponse.json({
          ok: true,
          ...stored,
          recorded: false,
          message: 'PDF는 보관됐지만 경로를 기록하지 못했습니다 — pdf_generated_at 마이그레이션을 적용하세요.',
        });
      }
      throw new Error(error.message);
    }
    return NextResponse.json({ ok: true, recorded: true, ...stored });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    if (e instanceof Error && isMissingTableMessage(e.message)) {
      return NextResponse.json(
        { ok: false, tableMissing: true, message: '정산 테이블이 아직 적용되지 않았습니다.' },
        { status: 503 },
      );
    }
    console.error('[ops-finance/periods/:period/pdf] POST error:', e);
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : 'internal_error' },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ period: string }> }) {
  try {
    await requireAdmin(req);
    const { period } = await ctx.params;
    if (!isValidPeriod(period)) {
      return NextResponse.json({ ok: false, message: 'invalid_period' }, { status: 400 });
    }
    const kind = parseKind(req.nextUrl.searchParams.get('kind') ?? 'statement');
    if (!kind) {
      return NextResponse.json({ ok: false, message: 'kind must be statement or invoice' }, { status: 400 });
    }

    const supabase = createServerClient();
    const detail = await loadPeriodDetail(supabase, period);
    const storedPath =
      kind === 'statement'
        ? detail.period
          ? await fetchStatementPdfPath(supabase, detail.period.id)
          : null
        : (detail.invoice?.pdf_url ?? null);

    return NextResponse.json({
      ok: true,
      kind,
      path: storedPath,
      signedUrl: await financeDocSignedUrl(supabase as unknown as FinanceDocStorageClient, storedPath),
    });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    if (e instanceof Error && isMissingTableMessage(e.message)) {
      return NextResponse.json({ ok: true, kind: 'statement', path: null, signedUrl: null });
    }
    console.error('[ops-finance/periods/:period/pdf] GET error:', e);
    return NextResponse.json({ ok: false, message: 'internal_error' }, { status: 500 });
  }
}
