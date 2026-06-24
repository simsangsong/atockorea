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
  "bg-white/85 backdrop-blur-md",
  "shadow-[0_6px_28px_-10px_rgba(15,23,42,0.1),0_2px_10px_-4px_rgba(15,23,42,0.06),inset_0_1px_0_0_rgba(255,255,255,0.82)]",
);

/**
 * 사이드바 프로필·네비 — Private 카드 계열 음영(원본보다 약하지만 떠 보이게 유지)
 */
const MYPAGE_SIDEBAR_PANEL_BASE = cn(
  "relative overflow-hidden rounded-home-card [isolation:isolate]",
  "bg-[radial-gradient(62%_54%_at_18%_22%,rgba(186,230,253,0.55)_0%,transparent_60%),radial-gradient(58%_46%_at_82%_14%,rgba(221,214,254,0.45)_0%,transparent_62%),radial-gradient(60%_50%_at_88%_80%,rgba(187,247,208,0.4)_0%,transparent_60%),radial-gradient(56%_48%_at_12%_88%,rgba(254,215,170,0.35)_0%,transparent_60%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)]",
  "shadow-[0_28px_58px_-18px_rgba(15,23,42,0.43),0_12px_32px_-14px_rgba(30,27,45,0.2),0_6px_18px_-8px_rgba(139,92,246,0.13),inset_0_1px_0_0_rgba(255,255,255,0.29)]",
  "transition-all duration-300 ease-out",
  "hover:shadow-[0_34px_68px_-18px_rgba(15,23,42,0.49),0_16px_40px_-14px_rgba(91,33,182,0.16),inset_0_1px_0_0_rgba(255,255,255,0.35)]",
  "antialiased [font-synthesis:none]",
);

export const MYPAGE_SIDEBAR_PROFILE_CARD = MYPAGE_SIDEBAR_PANEL_BASE;
export const MYPAGE_SIDEBAR_NAV = MYPAGE_SIDEBAR_PANEL_BASE;

/** 사이드바 메뉴 라벨·프로필 이름 — 살짝 큰 스케일 + 타이트 트래킹 */
export const MYPAGE_SIDEBAR_PRIMARY_TEXT = cn(
  "text-[15px] md:text-[16px] font-semibold leading-snug tracking-[-0.03em] text-slate-950",
);

/** 이메일 등 보조 한 줄 */
export const MYPAGE_SIDEBAR_SECONDARY_TEXT = cn(
  "text-[12px] font-medium leading-snug tracking-[-0.015em] text-slate-600",
);

/** 사이드바 메뉴 아이콘 — 큰 히트 + 살짝 가는 스트로크 */
export const MYPAGE_SIDEBAR_ICON = cn(
  "h-5 w-5 shrink-0 md:h-[22px] md:w-[22px]",
  "[&_path]:[stroke-width:1.25px]",
);

/**
 * 로그인/회원가입/비밀번호 리셋/OAuth 콜백 공통 카드 — MyPage 랜딩 허브(MYPAGE_SURFACE_PAGE)와 동일한 백색 카드 언어.
 * 배경 필드(AUTH_PAGE_BACKDROP)는 스튜디오 회색 그라디언트를 유지하여 로그인 전의 분리감은 보존(Hybrid).
 */
export const AUTH_FORM_CARD = cn(
  "overflow-hidden [isolation:isolate]",
  "[transform:translateZ(0)] [-webkit-backface-visibility:hidden]",
  "rounded-[30px] sm:rounded-[32px]",
  "border border-slate-200/75 bg-white",
  "shadow-[var(--home-shadow-neutral-card)]",
  "ring-1 ring-white/80",
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

/**
 * Google 블록 — warm ivory(크림 페이퍼) 톤의 명확한 웜 팔레트로 재구성.
 *   - bg: #faf5e6 (한 단계 더 또렷한 크림, 채도 상향)
 *   - border: #e5d9bd (샌드 베이지 hairline, slate/stone 대비 확실히 웜)
 *   - ring 제거: 흰색 ring 이 쿨 halo 를 만들어 border 가 쿨해 보이던 현상 해소
 *   - shadow: 웜 소프트 섀도(황토기) + 내부 미세 하이라이트
 */
export const AUTH_GOOGLE_PANEL = cn(
  "relative overflow-hidden p-4",
  "rounded-[1.5rem] sm:rounded-[1.75rem]",
  "border border-[#e5d9bd] bg-[#faf5e6]",
  "shadow-[inset_0_1px_0_rgba(255,252,240,0.9),0_6px_18px_-10px_rgba(120,95,45,0.18)]",
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

export const AUTH_SEGMENTED =
  "flex gap-1 rounded-2xl border border-slate-200/70 bg-slate-100/70 p-1.5 text-[13px] font-medium shadow-[inset_0_1px_2px_rgba(255,255,255,0.55),0_0_0_1px_rgba(15,23,42,0.03)]";

export const AUTH_FIELD_LABEL =
  "mb-2 block text-[13px] font-medium tracking-tight text-slate-700";

export const AUTH_INPUT =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-[16px] text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/12";

/** Auth 전용 비밀번호 show/hide 토글과 함께 쓸 때 오른쪽 안쪽 여백 */
export const AUTH_INPUT_WITH_TOGGLE = cn(AUTH_INPUT, "pr-12");

/** 6자리 OTP 코드 입력 — 중앙 정렬·큰 글자·widened tracking */
export const AUTH_OTP_INPUT = cn(
  AUTH_INPUT,
  "text-center text-2xl font-semibold tracking-[0.45em]",
);

/** 체크박스 — 약관·개인정보 동의 등 (슬레이트 악센트로 통일) */
export const AUTH_CHECKBOX =
  "mt-1 h-4 w-4 shrink-0 rounded border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-slate-900/20";

/** 인라인 강조 링크 — 이용약관·개인정보·아이디 찾기·회원가입 링크 */
export const AUTH_LINK =
  "font-semibold text-slate-900 underline decoration-slate-300 underline-offset-4 transition-colors hover:decoration-slate-900";

/** 톤 다운된 보조 링크 — "비밀번호로 로그인", "뒤로가기" 등 */
export const AUTH_SUBTLE_LINK =
  "font-medium text-slate-600 underline-offset-4 transition-colors hover:text-slate-900 hover:underline";

/**
 * "다른 방법으로 로그인" 펼치기 버튼 — Google 블록 아래 접힌 상태의 CTA.
 * 백색 카드 내부에서 살짝 톤 다운된 secondary 버튼 느낌.
 */
export const AUTH_REVEAL_ALT_SIGNIN_BUTTON = cn(
  "group flex w-full items-center justify-center gap-2",
  "rounded-2xl border border-slate-200 bg-slate-50/80 px-5 py-3",
  "text-[13px] font-semibold text-slate-700",
  "outline-none transition-all",
  "hover:-translate-y-px hover:border-slate-300 hover:bg-white hover:text-slate-900",
  "focus-visible:ring-2 focus-visible:ring-slate-900/15 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
);

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

/** 전 My Page 포커스 링 토큰. `focus-visible:` 컨텍스트에서 일관된 슬레이트 링을 제공한다. */
export const MYPAGE_FOCUS_RING = cn(
  'focus:outline-none',
  'focus-visible:ring-2 focus-visible:ring-slate-900/35 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
);

/** 리스트·카드 로딩 스켈레톤 한 줄. */
export const MYPAGE_SKELETON_LINE = 'h-3 rounded-full bg-slate-200/80 animate-pulse';

/** 카드 모양 스켈레톤 블록. */
export const MYPAGE_SKELETON_BLOCK = 'rounded-2xl bg-slate-200/70 animate-pulse';
