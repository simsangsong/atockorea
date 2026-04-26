'use client';

import { cn } from '@/lib/utils';

type Props = {
  show: boolean;
  onToggle: () => void;
  showLabel: string;
  hideLabel: string;
  className?: string;
};

/**
 * Eye / eye-off 토글 — 비밀번호 입력 오른쪽 내부에 absolute로 겹쳐두는 용도.
 * 부모 래퍼가 `relative`여야 하며, 입력에는 `AUTH_INPUT_WITH_TOGGLE` 토큰을 사용해
 * 오른쪽 내부 여백을 확보한 상태에서 사용한다.
 */
export function PasswordToggle({ show, onToggle, showLabel, hideLabel, className }: Props) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={show ? hideLabel : showLabel}
      aria-pressed={show}
      className={cn(
        'absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-2xl text-slate-400 transition-colors hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/15 focus-visible:ring-offset-1 focus-visible:ring-offset-white',
        className,
      )}
    >
      {show ? (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.757 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.243 4.243L9.88 9.88" />
        </svg>
      ) : (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.644C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .644C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </svg>
      )}
    </button>
  );
}
