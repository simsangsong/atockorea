import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin, AdminAuthFailure, adminAuthJsonResponse } from '@/lib/auth';
import { getFinanceConfig } from '@/lib/ops/finance/config';
import { isDraftDocument } from '@/lib/ops/finance/documents';
import { decryptGuidePii, piiEncryptionAvailable } from '@/lib/ops/guides/pii';
import { logPiiAccess } from '@/lib/ops/guides/registry';
import { isValidPeriod } from '@/lib/ops/tax/assignments';
import {
  listSettlements,
  listSettlementsForYear,
  type GuideSettlementRow,
} from '@/lib/ops/tax/settlement';
import {
  TOURISM_GUIDE_BUSINESS_CODE,
  buildAnnualForm,
  buildMonthlyForm,
  csvFilename,
  csvWithBom,
  isTaxFormKey,
  renderFormHtml,
  type AnnualPerson,
  type PayerInfo,
  type TaxFormDoc,
  type TaxFormKey,
  type WithholdingPerson,
} from '@/lib/ops/tax/forms';

export const dynamic = 'force-dynamic';

/**
 * 세무 서식 생성 (§6.9) — 생성·검증·보관까지. 🔴 제출은 하지 않는다(D10).
 *
 *   GET /api/admin/guide-settlements/[period]/forms/[form]
 *       ?format=json (기본) | csv | html
 *
 * form: withholding-report | simplified | receipt | annual
 *
 * ── 주민번호가 나가는 경로는 정확히 두 개다 ────────────────────────────────
 *   · format=csv  : 홈택스 업로드/세무사 검수용 파일 (UTF-8 BOM)
 *   · format=html : 인쇄 뷰가 그대로 화면에 꽂는 서식 조각
 * 둘 다 **서식 렌더 결과**다. 기본 JSON 응답에는 마스크(900101-1******)만 실린다 —
 * 목록·미리보기가 평문을 들고 다니면 브라우저 캐시·로그·스크린샷 어디로든 샌다.
 * 복호화가 일어나는 순간 ops_guide_pii_access_log에 가이드당 1행이 남고, 그 기입이
 * 실패하면 복호화도 하지 않는다(fail-closed — reveal 라우트와 같은 규칙).
 *
 * ⚠ 폴더 이름이 `[key]`인 이유는 형제 라우트 `[key]/route.ts`(정산행 id)와 같은
 *   레벨이기 때문이다. Next.js는 같은 자리에 이름이 다른 동적 세그먼트를 허용하지
 *   않는다. 여기서 받는 값은 기간('YYYY-MM' 또는 연간 서식의 'YYYY')이다.
 */

type Format = 'json' | 'csv' | 'html';

/** 지급자(원천징수의무자) = 한국 종합여행업 법인. 없는 값은 지어내지 않고 빈칸. */
function payerFrom(config: Awaited<ReturnType<typeof getFinanceConfig>>): PayerInfo {
  return {
    businessRegistrationNumber: config.krBizRegNo,
    businessName: config.krLegalName,
    // ops_finance_config에 대표자·연락처 컬럼이 없다. 빈칸으로 두고 사람이 서식에
    // 손으로 채운다 — 그럴듯한 값을 만들어 넣는 것보다 낫다.
    representativeName: null,
    businessAddress: config.krAddress,
    businessContact: null,
    businessTypeCode: TOURISM_GUIDE_BUSINESS_CODE,
  };
}

interface GuideIdentity {
  id: string;
  name: string;
  rrnMasked: string | null;
  rrnEnc: string | null;
}

async function fetchGuideIdentities(
  supabase: ReturnType<typeof createServerClient>,
  guideIds: string[],
): Promise<Map<string, GuideIdentity>> {
  const map = new Map<string, GuideIdentity>();
  if (guideIds.length === 0) return map;
  const { data, error } = await supabase
    .from('ops_guides')
    .select('id, name, rrn_masked, rrn_enc')
    .in('id', [...new Set(guideIds)]);
  if (error) throw new Error(error.message ?? 'guide lookup failed');
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    map.set(String(row.id), {
      id: String(row.id),
      name: String(row.name ?? ''),
      rrnMasked: (row.rrn_masked as string) ?? null,
      rrnEnc: (row.rrn_enc as string) ?? null,
    });
  }
  return map;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ key: string; form: string }> },
) {
  try {
    const admin = await requireAdmin(req);
    const { key: period, form } = await params;

    if (!isTaxFormKey(form)) {
      return NextResponse.json(
        { ok: false, message: 'form은 withholding-report · simplified · receipt · annual 중 하나여야 합니다.' },
        { status: 400 },
      );
    }
    const formKey = form as TaxFormKey;
    const annual = formKey === 'annual';
    // 연간 서식은 'YYYY'도 받고 'YYYY-MM'도 받는다(화면이 기간 선택을 공유한다).
    const year = annual ? (period ?? '').slice(0, 4) : '';
    if (annual ? !/^\d{4}$/.test(year) : !isValidPeriod(period)) {
      return NextResponse.json(
        { ok: false, message: annual ? '연간 서식은 YYYY 또는 YYYY-MM이 필요합니다.' : 'period는 YYYY-MM 형식이어야 합니다.' },
        { status: 400 },
      );
    }

    const formatParam = req.nextUrl.searchParams.get('format') ?? 'json';
    if (!['json', 'csv', 'html'].includes(formatParam)) {
      return NextResponse.json({ ok: false, message: 'format은 json · csv · html 중 하나입니다.' }, { status: 400 });
    }
    const format = formatParam as Format;

    const supabase = createServerClient();
    const [config, rows] = await Promise.all([
      getFinanceConfig(supabase),
      annual ? listSettlementsForYear(supabase, year) : listSettlements(supabase, period),
    ]);

    // 지급액 0원인 가이드는 서식에 올리지 않는다(신고 대상이 아니다).
    const payable = rows.filter((r) => r.gross_krw > 0);
    const identities = await fetchGuideIdentities(supabase, payable.map((r) => r.guide_id));

    // ── 복호화 구간 (렌더 산출물로 나가는 경우에만) ────────────────────────
    const wantsPlaintext = format !== 'json' && payable.length > 0 && formKey !== 'withholding-report';
    const warnings: string[] = [];
    const plaintextByGuide = new Map<string, string | null>();

    if (wantsPlaintext) {
      if (!piiEncryptionAvailable()) {
        // 키가 없으면 주민번호 칸을 비운 채 서식을 낸다 — 서식 자체는 여전히
        // 쓸모가 있고, 아무것도 복호화하지 않았으니 감사로그도 남기지 않는다.
        warnings.push('암호화 키(OPS_GUIDE_PII_ENC_KEY)가 없어 주민등록번호 칸을 비웠습니다.');
      } else {
        const purpose = `${annual ? year : period} 지급명세서 생성`;
        for (const guideId of new Set(payable.map((r) => r.guide_id))) {
          const identity = identities.get(guideId);
          if (!identity?.rrnEnc) continue;
          // 감사로그가 먼저다. 기입 실패 = 복호화 불가(흔적 없는 열람 금지).
          const logged = await logPiiAccess(supabase, {
            guideId,
            field: 'rrn',
            actor: admin.email || admin.id || null,
            purpose,
          });
          if (!logged) {
            return NextResponse.json(
              { ok: false, message: '열람 기록을 남기지 못해 서식을 생성하지 않았습니다. 잠시 후 다시 시도해 주세요.' },
              { status: 503 },
            );
          }
          try {
            plaintextByGuide.set(guideId, decryptGuidePii(identity.rrnEnc));
          } catch (err) {
            console.error('[guide-settlements/forms] decrypt failed', err);
            warnings.push(`${identity.name}: 주민등록번호를 복호화하지 못했습니다(키 변경 가능성).`);
            plaintextByGuide.set(guideId, null);
          }
        }
      }
    }

    /** 이 응답 형식에서 소득자 행에 넣을 값. JSON이면 마스크뿐이다. */
    function residentFor(guideId: string): string | null {
      if (format === 'json') return identities.get(guideId)?.rrnMasked ?? null;
      if (!wantsPlaintext) return null;
      return plaintextByGuide.get(guideId) ?? null;
    }

    let doc: TaxFormDoc;
    if (annual) {
      const byGuide = new Map<string, AnnualPerson>();
      for (const r of payable) {
        const entry = byGuide.get(r.guide_id) ?? {
          name: identities.get(r.guide_id)?.name ?? r.guide_id.slice(0, 8),
          residentNumber: residentFor(r.guide_id),
          months: [],
        };
        entry.months.push({ period: r.period, gross: r.gross_krw });
        byGuide.set(r.guide_id, entry);
      }
      for (const entry of byGuide.values()) entry.months.sort((a, b) => (a.period < b.period ? -1 : 1));
      doc = buildAnnualForm({
        year: Number(year),
        payer: payerFrom(config),
        people: [...byGuide.values()].sort((a, b) => a.name.localeCompare(b.name, 'ko')),
      });
    } else {
      const people: WithholdingPerson[] = payable
        .map((r: GuideSettlementRow) => ({
          name: identities.get(r.guide_id)?.name ?? r.guide_id.slice(0, 8),
          residentNumber: residentFor(r.guide_id),
          gross: r.gross_krw,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
      const [y, m] = period.split('-').map(Number);
      doc = buildMonthlyForm(formKey as Exclude<TaxFormKey, 'annual'>, {
        year: y,
        month: m,
        payer: payerFrom(config),
        people,
      });
    }

    // 전문가 확인 전에는 전부 DRAFT (finance 슬라이스와 같은 스위치).
    const draft = isDraftDocument(config.expertReviewed);

    if (format === 'csv') {
      const body = draft
        ? csvWithBom({ ...doc, notes: ['⚠ DRAFT — 세무사 확인 전 초안입니다. 제출용이 아닙니다.', ...doc.notes] })
        : csvWithBom(doc);
      return new NextResponse(body, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${csvFilename(doc)}"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    if (format === 'html') {
      return new NextResponse(renderFormHtml(doc), {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }

    return NextResponse.json({
      ok: true,
      form: formKey,
      title: doc.title,
      period: doc.period,
      draft,
      // ⚠ 이 aoa의 주민번호 칸은 **마스크**다. 평문은 csv/html 산출물에만 있다.
      aoa: doc.aoa,
      headerRowIndex: doc.headerRowIndex,
      notes: doc.notes,
      guideCount: new Set(payable.map((r) => r.guide_id)).size,
      warnings,
    });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[GET /api/admin/guide-settlements/:period/forms/:form]', msg);
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  }
}
