"use client";

import Link from "next/link";
import { Calculator, ChevronRight, ListChecks, WandSparkles } from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { homeBtnPrimary, homeBtnSecondary } from "@/lib/home/home-button-classes";

type BuildAction =
  | {
      kind: "button";
      label: string;
      onClick: () => void;
    }
  | {
      kind: "link";
      label: string;
      href: string;
    };

function Copy({ ko, en }: { ko: string; en: string }) {
  const { locale } = useI18n();
  return <>{locale === "ko" ? ko : en}</>;
}

function PriceRow({
  label,
  total,
  perPerson,
  note,
  emphasis = false,
}: {
  label: ReactNode;
  total: string;
  perPerson: string;
  note: ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 border-t border-slate-200/70 py-3 first:border-t-0",
        emphasis && "text-slate-950",
      )}
    >
      <div>
        <p className="text-[13px] font-semibold text-slate-800">{label}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{note}</p>
      </div>
      <div className="text-right">
        <p className="text-[13px] font-bold text-slate-900">{total}</p>
        <p className="mt-0.5 text-[11px] text-slate-500">{perPerson}</p>
      </div>
    </div>
  );
}

export function MatchResultNextSteps({
  browseHref = "/tours/list",
  buildAction,
}: {
  browseHref?: string;
  buildAction: BuildAction;
}) {
  return (
    <section className="mt-4 border-t border-slate-200/70 pt-4 md:mt-5 md:pt-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-center">
        <Link
          href={browseHref}
          className={cn(homeBtnSecondary, "inline-flex min-h-[2.75rem] items-center justify-center gap-2 sm:w-auto sm:px-5")}
        >
          <ListChecks className="h-4 w-4" aria-hidden />
          <Copy ko="다른 옵션 보기" en="See other options" />
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>

        {buildAction.kind === "button" ? (
          <button
            type="button"
            onClick={buildAction.onClick}
            className={cn(homeBtnPrimary, "inline-flex min-h-[2.75rem] items-center justify-center gap-2 sm:w-auto sm:px-5")}
          >
            <WandSparkles className="h-4 w-4" aria-hidden />
            {buildAction.label}
          </button>
        ) : (
          <Link
            href={buildAction.href}
            className={cn(homeBtnPrimary, "inline-flex min-h-[2.75rem] items-center justify-center gap-2 sm:w-auto sm:px-5")}
          >
            <WandSparkles className="h-4 w-4" aria-hidden />
            {buildAction.label}
          </Link>
        )}
      </div>

      <div className="mt-4 rounded-card border border-slate-200/80 bg-slate-50/80 p-4 md:mt-5">
        <div className="mb-2 flex items-center gap-2">
          <Calculator className="h-4 w-4 text-slate-600" aria-hidden />
          <h4 className="text-[13px] font-bold uppercase tracking-[0.1em] text-slate-700">
            <Copy ko="4인 가격 비교" en="4-person value check" />
          </h4>
        </div>
        <p className="mb-2 text-[12px] leading-relaxed text-slate-600">
          <Copy
            ko="4명이 움직이면 프라이빗 차량이 생각보다 비싸지 않습니다. 최저가만 보면 버스/조인 투어가 낮고, 편의성까지 보면 프라이빗이 경쟁력 있는 구간입니다."
            en="For four travelers, a private vehicle is often closer than it looks. Bus or join tours can still be cheapest, but private starts to compete once comfort and pickup flexibility matter."
          />
        </p>

        <div>
          <PriceRow
            label={<Copy ko="일반 조인/스몰그룹" en="Standard join/small-group" />}
            total="USD 236"
            perPerson="USD 59 pp"
            note={<Copy ko="공개 상품 기준 1인 가격. 일정과 픽업은 정해진 틀을 따릅니다." en="Based on public per-person pricing; schedule and pickup are mostly fixed." />}
          />
          <PriceRow
            label={<Copy ko="프라이빗 차량" en="Private car" />}
            total="USD 249"
            perPerson="~USD 62 pp"
            note={<Copy ko="4인 기준 1인 약 62달러. 호텔 픽업과 동선 조정 가치가 커집니다." en="About USD 62 per person for four; hotel pickup and route control become the value." />}
            emphasis
          />
          <PriceRow
            label={<Copy ko="최저가 버스형" en="Lowest bus-style option" />}
            total="USD 208+"
            perPerson="USD 52+ pp"
            note={<Copy ko="가격만 가장 낮을 수 있지만, 날짜/지역/픽업 조건이 맞을 때만 유리합니다." en="Can be the lowest price, but only when date, region, and pickup conditions fit." />}
          />
        </div>
      </div>
    </section>
  );
}
