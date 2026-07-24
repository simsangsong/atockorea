-- AtoC 통합 플랜 §6.3 (전수감사 G2) — 정산 문서 PDF 보관 경로
--
-- 배경: Phase 3은 "PDF 라이브러리를 추가하지 않는다(설계 결정 3)"로 인쇄 뷰를
-- 택했고, 그 결과 ops_intercompany_invoices.pdf_url이 **영구 빈 값**으로 남았다.
-- 인쇄→PDF 저장으로 실무는 굴러가지만 세무사·은행 제출처럼 **첨부 파일이 필요한
-- 경로에서 매번 사람 손이 한 번 더 든다**(§14.6 G2). 이 마이그레이션은 그
-- 첨부 파일의 보관 위치를 스키마에 만든다.
--
-- 설계 결정 (이번 슬라이스):
--   1. 🔴 저장은 **private 버킷 `ops-finance-docs`**. ops_no_show_evidence와 같은
--      정책이다 — 문서에 양사 법적명칭·사업자등록번호·EIN·수취계좌·주문별 금액이
--      들어가므로 public 버킷은 금지. 조회는 10분짜리 서명 URL로만 한다.
--   2. 그래서 컬럼에 들어가는 값은 **URL이 아니라 storage object path**다.
--      서명 URL을 컬럼에 넣으면 만료된 죽은 링크가 남는다.
--      pdf_url은 이름을 유지한 채(기존 코드/플랜 §6.3 표기 그대로) 경로를 담는다
--      — 지금까지 항상 null이었으므로 의미 변경으로 깨질 기존 값이 없다.
--   3. 재생성은 덮어쓰지 않는다. 객체 경로에 생성 시각 스탬프가 들어가므로
--      전문가 확인 전/후, 법인정보 입력 전/후 문서가 각각 남는다(감사 추적).
--   4. DRAFT 규칙(결정 4)은 그대로다: ops_finance_config.expert_reviewed가
--      true가 아니면 생성되는 PDF에 DRAFT 워터마크가 찍힌다. 스키마 변경 없음.
--   5. 🔴 D10 — 이 스키마 어디에도 "제출/발송" 상태가 없다. 시스템은 파일을
--      만들어 보관할 뿐이고, 제출은 사람이 한다.
--
-- additive only: 컬럼 3개 추가 + 코멘트. 기존 행/제약/인덱스 변경 없음.
--
-- ⚠ 적용 금지 상태로 파일만 커밋. 적용은 사람 검토 후.
--
-- ---------------------------------------------------------------------------
-- 적용 전 점검
-- ---------------------------------------------------------------------------
--   select to_regclass('public.ops_settlement_periods')    as t1,
--          to_regclass('public.ops_intercompany_invoices') as t2;   -- 둘 다 not null
--
--   -- pdf_url이 정말로 전부 비어 있는가? (결정 2의 전제)
--   select count(*) filter (where pdf_url is not null) as non_null_pdf_url,
--          count(*)                                    as total
--     from ops_intercompany_invoices;                                -- non_null = 0 이어야 함
--
--   -- 추가할 컬럼이 이미 있지는 않은가? (0행이어야 함)
--   select table_name, column_name from information_schema.columns
--    where (table_name = 'ops_settlement_periods'
--             and column_name in ('statement_pdf_path','statement_pdf_generated_at'))
--       or (table_name = 'ops_intercompany_invoices'
--             and column_name = 'pdf_generated_at');

begin;

-- ============================================================================
-- 1. 월 정산서 PDF (내부 문서 — 5472 작성 원천, 대사 문서)
-- ============================================================================
alter table ops_settlement_periods
  add column if not exists statement_pdf_path text;
alter table ops_settlement_periods
  add column if not exists statement_pdf_generated_at timestamptz;

comment on column ops_settlement_periods.statement_pdf_path is
  'private 버킷 ops-finance-docs 안의 월 정산서 PDF 객체 경로. 공개 URL이 아니다 — 조회는 단기 서명 URL로만(ops_no_show_evidence와 동일 정책). null = 아직 생성 안 함.';
comment on column ops_settlement_periods.statement_pdf_generated_at is
  '마지막 정산서 PDF 생성 시각. 재생성은 덮어쓰지 않고 새 객체를 남기므로 이 값은 최신본을 가리킨다.';

-- ============================================================================
-- 2. 인터컴퍼니 인보이스 PDF (유일한 정식 발행 문서, D11)
-- ============================================================================
alter table ops_intercompany_invoices
  add column if not exists pdf_generated_at timestamptz;

comment on column ops_intercompany_invoices.pdf_url is
  'private 버킷 ops-finance-docs 안의 인보이스 PDF **객체 경로**(공개 URL 아님). 조회는 단기 서명 URL로만. 결정 3에서 "미사용"이던 컬럼을 §14.6 G2 해소로 채운다.';
comment on column ops_intercompany_invoices.pdf_generated_at is
  '마지막 인보이스 PDF 생성 시각. null = 아직 생성 안 함(= 첨부 파일 없이 인쇄 뷰만 있는 상태).';

commit;

-- ============================================================================
-- Verify after apply:
--   1. 3개 컬럼 존재, 전부 null (기존 행 무변경)
--   2. Storage 버킷 `ops-finance-docs`가 **Public 해제** 상태인지 확인.
--      코드가 첫 생성 때 public:false로 자동 생성하지만, 대시보드에서 미리
--      만든다면 Public 체크를 반드시 해제할 것.
--   3. 스모크:
--        POST /api/admin/ops-finance/periods/2026-08/pdf {"kind":"statement"}
--          → path=finance/2026-08/statement-2026-08-<stamp>.pdf, signedUrl 발급
--        같은 호출 한 번 더 → stamp가 다른 새 객체(덮어쓰기 없음)
--        ops_finance_config.expert_reviewed=false인 동안에는 PDF에 DRAFT 워터마크
-- ============================================================================
