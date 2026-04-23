import { cn } from "@/lib/utils";

/**
 * COMPARE·Trust·마이페이지·인증 셸 공통 — 흰 테두리 + 검정 계열 바깥 그림자.
 */
export const HOME_OUTER_SHELL_EDGE = cn(
  "border border-white/80",
  "shadow-[var(--home-shadow-panel),0_0_0_1px_rgba(15,23,42,0.04),0_32px_64px_-28px_rgba(15,23,42,0.1)]",
);

/**
 * 홈 Trust 섹션(`HomeBookWithConfidence`)·마이페이지·인증 폼이 공유하는 외곽 셸
 * (`globals.css` `.home-shell-glass`: 그라데이션 + 블러 + 노이즈).
 */
export const HOME_OUTER_SHELL_SURFACE = cn(
  "rounded-[3.75rem] home-shell-glass",
  HOME_OUTER_SHELL_EDGE,
);

/**
 * My Page — 홈 `HomeBookWithConfidence` 외곽 셸·내부 카드와 동일 계열:
 * 회청 배경 셸 + 흰색 라운드 카드 + 동일 그림자/테두리.
 */
export const MYPAGE_SHELL = cn(
  HOME_OUTER_SHELL_SURFACE,
  "p-3 sm:p-4 md:rounded-[3.75rem] md:p-4 space-y-3",
);

/** 메인 패널 — 프로필·메뉴·설정·인증 폼 내부 카드 (홈 neutral elevated 카드 토큰 정렬) */
export const MYPAGE_SURFACE_PAGE = cn(
  "rounded-[30px] border border-slate-200/75 bg-white",
  "shadow-[var(--home-shadow-neutral-card)]",
  "ring-1 ring-white/80",
  "antialiased [font-synthesis:none]",
);

/** 리스트·내부 타일 */
export const MYPAGE_SURFACE = cn(
  "rounded-2xl border border-white/70",
  "bg-white/75 backdrop-blur-xl backdrop-saturate-150",
  "shadow-[0_6px_28px_-10px_rgba(15,23,42,0.1),0_2px_10px_-4px_rgba(15,23,42,0.06),inset_0_1px_0_0_rgba(255,255,255,0.82)]",
);

/**
 * 로그인/회원가입 단일 카드 — 이중 테두리·중첩 셸 없이 한 겹만 사용.
 */
export const AUTH_FORM_CARD = cn(
  "overflow-hidden [isolation:isolate]",
  "[transform:translateZ(0)] [-webkit-backface-visibility:hidden]",
  "rounded-3xl sm:rounded-[1.85rem] md:rounded-[2rem]",
  /* 밝은 그레이 패널 — main 필드(#e0~#c8)보다 밝아 구분, 전역 메시와도 다른 단일 면 */
  "border border-white/85",
  "bg-gradient-to-b from-[#f4f5f8] via-[#edeff4] to-[#e8eaef]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_0_0_1px_rgba(0,0,0,0.072),0_28px_60px_-34px_rgba(0,0,0,0.2),0_12px_28px_-16px_rgba(0,0,0,0.09)]",
  "antialiased [font-synthesis:none]",
);

/** @deprecated `AUTH_FORM_CARD`와 동일 — 예전 바깥 셸 */
export const AUTH_FORM_SHELL = AUTH_FORM_CARD;

/** @deprecated `AUTH_FORM_CARD`와 동일 — 예전 안쪽 카드 */
export const AUTH_INNER_CARD = AUTH_FORM_CARD;

/** Latin-only serif (next/font Playfair on `:root` body) — use for brand wordmark, not CJK titles */
export const AUTH_BRAND_SERIF =
  "[font-family:var(--font-display-serif),Georgia,'Times_New_Roman',serif]";

export const AUTH_BRAND_PILL = cn(
  AUTH_BRAND_SERIF,
  "inline-flex items-center justify-center rounded-full",
  /* 순백 없이 한 톤 밝은 뉴트럴 그레이 */
  "border border-white/90 bg-gradient-to-b from-[#f9fafc] to-[#f1f3f8] px-6 py-2.5",
  "text-[12px] font-bold uppercase tracking-[0.16em] text-neutral-900 sm:text-[13px]",
  "shadow-[0_1px_0_rgba(255,255,255,0.82)_inset,0_6px_20px_-8px_rgba(0,0,0,0.1),0_0_0_1px_rgba(0,0,0,0.055)]",
);

export const AUTH_LEAD =
  "mx-auto mt-3 max-w-[22rem] text-center text-[15px] font-normal leading-[1.65] text-neutral-600";

/** Google 블록 — 카드보다 살짝 밝은 그레이로만 구분 */
export const AUTH_GOOGLE_PANEL = cn(
  "relative overflow-hidden p-4",
  "rounded-[1.75rem] sm:rounded-[2rem]",
  "border border-white/75",
  "[background-image:linear-gradient(165deg,#f8f9fb_0%,#f1f3f7_45%,#ebeef2_100%),radial-gradient(circle_at_1px_1px,rgba(82,82,82,0.045)_1px,transparent_0)]",
  "[background-size:auto,17px_17px]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_0_0_1px_rgba(0,0,0,0.055),0_8px_24px_-16px_rgba(0,0,0,0.08)]",
);

/**
 * 로그인·가입 main 전용 필드 배경 — 전역 메시와 겹쳐 보이지 않게 중립 그레이 스튜디오 톤만 사용(`body::before` 미수정).
 */
export const AUTH_PAGE_BACKDROP = cn(
  "isolate",
  "before:pointer-events-none before:absolute before:inset-0 before:-z-10",
  /* 카드(밝은 그레이 #f4~#e8)보다 한 단계 어두운 필드 */
  "before:bg-[linear-gradient(180deg,#e0e2e8_0%,#d3d6de_44%,#c8ccd5_100%)]",
  "after:pointer-events-none after:absolute after:inset-0 after:-z-10",
  "after:bg-[radial-gradient(ellipse_95%_72%_at_50%_-8%,rgba(255,255,255,0.22),transparent_60%)]",
);

export const AUTH_GOOGLE_CTA_BUTTON = cn(
  "group flex w-full items-center justify-center gap-3",
  "rounded-[1.35rem] sm:rounded-[1.5rem]",
  "border border-white/90 bg-[#fbfbfc]",
  "px-5 py-3.5 text-[14px] font-semibold text-neutral-900",
  "shadow-[var(--home-shadow-btn-secondary)]",
  "outline-none transition-all",
  "hover:-translate-y-px hover:border-white hover:shadow-[0_16px_36px_-18px_rgba(0,0,0,0.14)] active:translate-y-0",
  "focus-visible:ring-2 focus-visible:ring-neutral-900/12 focus-visible:ring-offset-2 focus-visible:ring-offset-[#d6d8df]",
);

export const AUTH_SEGMENTED =
  "flex gap-1 rounded-2xl border border-white/70 bg-[#dfe2e8]/55 p-1.5 text-[13px] font-medium shadow-[inset_0_1px_2px_rgba(255,255,255,0.35),0_0_0_1px_rgba(0,0,0,0.045)]";

export const AUTH_FIELD_LABEL =
  "mb-2 block text-[13px] font-medium tracking-tight text-neutral-700";

export const AUTH_INPUT =
  "w-full rounded-2xl border border-neutral-200/95 bg-white px-4 py-3.5 text-[15px] text-neutral-900 outline-none transition-all placeholder:text-neutral-400/90 focus:border-neutral-800 focus:ring-2 focus:ring-neutral-900/10";

/* 타이포 — 컴팩트·대비 높은 네이비/슬레이트 */
export const MYPAGE_TITLE =
  "text-lg font-bold tracking-tight text-[#0f172a] sm:text-xl";

export const MYPAGE_SUBTITLE = "text-[13px] font-medium leading-snug text-[#475569]";

export const MYPAGE_SECTION_TITLE = "text-[15px] font-bold tracking-tight text-[#0f172a]";

/** 로그인·가입 페이지 메인 제목 — 본문 폰트(Pretendard/Noto)로 CJK 정돈 */
export const AUTH_PAGE_TITLE = cn(
  "text-center text-[1.5rem] font-semibold leading-[1.2] tracking-[-0.035em] text-neutral-900 sm:text-[1.6875rem]",
);

export const MYPAGE_BODY = "text-[13px] leading-relaxed text-[#0f172a]";

export const MYPAGE_MUTED = "text-[12px] text-[#475569]";

export const MYPAGE_LABEL = "text-[12px] font-semibold text-[#334155]";

export function mypageShell(className?: string) {
  return cn(MYPAGE_SHELL, className);
}

export function mypagePageCard(className?: string) {
  return cn(MYPAGE_SURFACE_PAGE, className);
}

export function mypageCard(className?: string) {
  return cn(MYPAGE_SURFACE, className);
}

export function authFormShell(className?: string) {
  return cn(AUTH_FORM_CARD, className);
}
