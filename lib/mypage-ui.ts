import { cn } from "@/lib/utils";

/**
 * COMPARE·Trust·마이페이지·인증 셸 공통 — 흰 테두리 + 검정 계열 바깥 그림자.
 */
export const HOME_OUTER_SHELL_EDGE = cn(
  "border border-white/75",
  "shadow-[var(--home-shadow-panel),0_0_0_1px_rgba(15,23,42,0.038)]",
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

/** 메인 패널 — 프로필·메뉴·설정 블록 (홈 Trust 카드 article 과 동일 톤) */
export const MYPAGE_SURFACE_PAGE = cn(
  "rounded-[30px] border border-slate-200/90 bg-white",
  "shadow-[0_4px_28px_-2px_rgba(15,23,42,0.07)]",
  "ring-1 ring-slate-900/[0.04]",
  "antialiased [font-synthesis:none]",
);

/** 리스트·내부 타일 */
export const MYPAGE_SURFACE = cn(
  "rounded-2xl border border-white/55",
  "bg-white/70 backdrop-blur-xl backdrop-saturate-150",
  "shadow-[0_2px_20px_-2px_rgba(15,23,42,0.08),inset_0_1px_0_0_rgba(255,255,255,0.75)]",
);

/** 로그인/회원가입 폼 래퍼 — 마이페이지와 동일 셸 톤 */
export const AUTH_FORM_SHELL = cn(HOME_OUTER_SHELL_SURFACE, "p-3 sm:p-4");

/* 타이포 — 컴팩트·대비 높은 네이비/슬레이트 */
export const MYPAGE_TITLE =
  "text-lg font-bold tracking-tight text-[#0f172a] sm:text-xl";

export const MYPAGE_SUBTITLE = "text-[13px] font-medium leading-snug text-[#475569]";

export const MYPAGE_SECTION_TITLE = "text-[15px] font-bold tracking-tight text-[#0f172a]";

/** 로그인·가입 페이지 메인 제목 */
export const AUTH_PAGE_TITLE =
  "text-center text-[1.25rem] font-bold tracking-tight text-[#0f172a] sm:text-[1.375rem]";

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
  return cn(AUTH_FORM_SHELL, className);
}
