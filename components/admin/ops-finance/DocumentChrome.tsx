'use client';

/**
 * 인쇄 문서 공통 크롬 (Phase 3 §6.4).
 *
 * PDF 라이브러리를 쓰지 않는다(코디네이터 결정 3) — 문서는 DB 데이터에서 결정론적으로
 * 재렌더되는 페이지이고, admin이 브라우저 인쇄(⌘P/Ctrl+P → PDF로 저장)로 뽑는다.
 * 그래서 여기 있는 @media print CSS가 사실상 문서의 조판 엔진이다:
 * admin 레이아웃의 사이드바·헤더·모바일 nav를 인쇄에서 걷어내고 A4 한 장을 남긴다.
 *
 * DRAFT 워터마크는 ops_finance_config.expert_reviewed가 명시적 true일 때만 사라진다
 * (결정 4). 모르면 DRAFT — 전문가 확인 전 문서가 확정본처럼 보이는 것이 최악이다.
 */

import type { ReactNode } from 'react';
import { Printer } from 'lucide-react';

export const DOC_PRINT_CSS = `
@media print {
  aside, nav, header { display: none !important; }
  main { overflow: visible !important; padding: 0 !important; }
  .fdoc-noprint { display: none !important; }
  .fdoc-page { padding: 0 !important; background: #fff !important; }
  .fdoc-sheet { border: 0 !important; box-shadow: none !important; padding: 0 !important; }
  .fdoc-avoid-break { page-break-inside: avoid; break-inside: avoid; }
  .fdoc-watermark { position: fixed; }
}
@page { size: A4; margin: 16mm; }
`;

export function DraftWatermark() {
  return (
    <div
      className="fdoc-watermark pointer-events-none fixed inset-0 z-10 flex items-center justify-center"
      aria-hidden
      data-testid="draft-watermark"
    >
      <span className="rotate-[-24deg] select-none text-[22vw] font-black leading-none tracking-widest text-neutral-900/[0.06] print:text-[140pt]">
        DRAFT
      </span>
    </div>
  );
}

export function DocumentShell({
  draft,
  title,
  subtitle,
  children,
  testId,
}: {
  draft: boolean;
  title: string;
  subtitle?: string;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <div className="fdoc-page relative min-h-screen bg-white p-6 text-neutral-900" data-testid={testId}>
      <style>{DOC_PRINT_CSS}</style>
      {draft ? <DraftWatermark /> : null}

      <div className="fdoc-noprint mb-4 flex flex-wrap items-center gap-3 border-b border-neutral-200 pb-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold">{title}</h1>
          {subtitle ? <p className="mt-0.5 text-xs text-neutral-500 tabular-nums">{subtitle}</p> : null}
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="flex h-11 items-center gap-1.5 rounded-xl bg-neutral-900 px-4 text-sm font-bold text-white"
          data-testid="doc-print-button"
        >
          <Printer size={14} aria-hidden />
          인쇄 / PDF 저장
        </button>
      </div>

      {draft ? (
        <p
          className="fdoc-noprint mb-4 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800"
          data-testid="draft-notice"
        >
          미국 CPA · 한국 세무사 확인 전 초안입니다. 확인이 끝나면
          ops_finance_config.expert_reviewed를 true로 바꿔야 DRAFT 표시가 사라집니다.
        </p>
      ) : null}

      <div className="fdoc-sheet relative z-20 mx-auto max-w-[190mm] rounded-xl border border-neutral-200 bg-white p-8">
        {children}
      </div>
    </div>
  );
}

/** 문서 하단 고정 고지 — 부가세 방침 미확정(§6.2). 숫자 대신 공백을 명시한다. */
export function VatNoticeLine({ notice }: { notice: string }) {
  return (
    <p
      className="mt-6 border-t border-neutral-200 pt-3 text-[11px] leading-relaxed text-neutral-500"
      data-testid="vat-notice"
    >
      ※ {notice}
    </p>
  );
}

export function EntityBlock({
  role,
  name,
  address,
  idLabel,
  idValue,
}: {
  role: string;
  name: string;
  address: string;
  idLabel: string;
  idValue: string;
}) {
  return (
    <div className="fdoc-avoid-break">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{role}</p>
      <p className="mt-1 text-sm font-bold text-neutral-900">{name}</p>
      <p className="mt-0.5 whitespace-pre-line text-xs text-neutral-600">{address}</p>
      <p className="mt-0.5 text-xs text-neutral-600">
        {idLabel}: <span className="tabular-nums">{idValue}</span>
      </p>
    </div>
  );
}
