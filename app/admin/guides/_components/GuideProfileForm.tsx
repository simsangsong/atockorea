'use client';

/**
 * 가이드 프로필 편집 폼 (§6.9).
 *
 * 민감 필드 취급이 이 컴포넌트의 요점이다:
 *   · 주민번호·계좌는 저장된 값을 **되불러오지 않는다**. 화면에는 마스크만 보이고,
 *     입력란은 언제나 비어 있다. 뭔가 적었을 때만 서버로 간다 — 폼을 열었다 닫는
 *     것만으로 평문이 왕복하는 경로를 아예 만들지 않는다.
 *   · 암호화 키가 없으면(piiKeyConfigured=false) 두 칸을 잠근다. 저장 버튼을 누른
 *     뒤에 400을 만나는 것보다, 못 쓴다는 걸 미리 아는 편이 낫다.
 *   · 주민번호 수집 근거를 입력란 옆에 한 줄로 밝힌다(바인딩 결정 3).
 */

import { useState } from 'react';
import { Lock, ShieldCheck } from 'lucide-react';
import type { GuideListRow } from '../_types';

const GUIDE_TYPES: Array<{ value: string; label: string }> = [
  { value: '', label: '미지정' },
  { value: 'driver', label: '기사' },
  { value: 'bus_guide', label: '안내' },
  { value: 'both', label: '겸업' },
];

const LANGUAGE_CHOICES = ['ko', 'en', 'ja', 'zh', 'zh-TW', 'es', 'fr', 'de', 'it', 'ru'];

export interface GuideFormValue {
  name: string;
  phone: string;
  email: string;
  languages: string[];
  guideType: string;
  bankName: string;
  bankHolder: string;
  certified: boolean;
  active: boolean;
  note: string;
  /** 입력했을 때만 전송되는 평문 필드. */
  residentNumber: string;
  bankAccount: string;
}

export function emptyForm(): GuideFormValue {
  return {
    name: '',
    phone: '',
    email: '',
    languages: [],
    guideType: '',
    bankName: '',
    bankHolder: '',
    certified: false,
    active: true,
    note: '',
    residentNumber: '',
    bankAccount: '',
  };
}

export function formFromRow(row: GuideListRow): GuideFormValue {
  return {
    name: row.name ?? '',
    phone: row.phone ?? '',
    email: row.email ?? '',
    languages: row.languages ?? [],
    guideType: row.guide_type ?? '',
    bankName: row.bank_name ?? '',
    bankHolder: row.bank_holder ?? '',
    certified: Boolean(row.certified),
    active: Boolean(row.active),
    note: row.note ?? '',
    residentNumber: '',
    bankAccount: '',
  };
}

const inputCls =
  'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[14px] text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none';
const labelCls = 'mb-1 block text-[12px] font-semibold text-slate-600';

export default function GuideProfileForm({
  value,
  onChange,
  piiKeyConfigured,
  rrnMasked,
  bankAccountMasked,
  onReveal,
}: {
  value: GuideFormValue;
  onChange: (next: GuideFormValue) => void;
  piiKeyConfigured: boolean;
  rrnMasked?: string | null;
  bankAccountMasked?: string | null;
  onReveal?: (field: 'rrn' | 'bank_account') => void;
}) {
  // 자유 입력 언어 칸의 임시 상태. 가이드를 바꾸면 부모가 `key`로 이 컴포넌트를
  // 새로 마운트하므로 여기서 초기화 이펙트를 돌릴 필요가 없다.
  const [langInput, setLangInput] = useState('');

  const set = <K extends keyof GuideFormValue>(key: K, v: GuideFormValue[K]) =>
    onChange({ ...value, [key]: v });

  const toggleLang = (code: string) => {
    const has = value.languages.includes(code);
    set('languages', has ? value.languages.filter((l) => l !== code) : [...value.languages, code]);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="guide-name">
            이름 <span className="text-rose-500">*</span>
          </label>
          <input
            id="guide-name"
            className={inputCls}
            value={value.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="홍길동"
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="guide-phone">
            연락처
          </label>
          <input
            id="guide-phone"
            className={inputCls}
            value={value.phone}
            onChange={(e) => set('phone', e.target.value)}
            placeholder="010-0000-0000"
            inputMode="tel"
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="guide-email">
            이메일
          </label>
          <input
            id="guide-email"
            className={inputCls}
            value={value.email}
            onChange={(e) => set('email', e.target.value)}
            placeholder="guide@example.com"
            inputMode="email"
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="guide-type">
            유형
          </label>
          <select
            id="guide-type"
            className={inputCls}
            value={value.guideType}
            onChange={(e) => set('guideType', e.target.value)}
          >
            {GUIDE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <span className={labelCls}>구사 언어</span>
        <div className="flex flex-wrap gap-1.5">
          {LANGUAGE_CHOICES.map((code) => {
            const on = value.languages.includes(code);
            return (
              <button
                key={code}
                type="button"
                onClick={() => toggleLang(code)}
                aria-pressed={on}
                className={`h-11 rounded-xl px-3 text-[13px] font-semibold transition ${
                  on ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {code.toUpperCase()}
              </button>
            );
          })}
        </div>
        {value.languages.some((l) => !LANGUAGE_CHOICES.includes(l)) && (
          <p className="mt-1.5 text-[12px] text-slate-500">
            기타: {value.languages.filter((l) => !LANGUAGE_CHOICES.includes(l)).join(', ')}
          </p>
        )}
        <div className="mt-2 flex gap-2">
          <input
            className={inputCls}
            value={langInput}
            onChange={(e) => setLangInput(e.target.value)}
            placeholder="목록에 없는 언어 코드 (예: th)"
          />
          <button
            type="button"
            onClick={() => {
              const code = langInput.trim().toLowerCase();
              if (code && !value.languages.includes(code)) set('languages', [...value.languages, code]);
              setLangInput('');
            }}
            className="h-11 shrink-0 rounded-xl bg-slate-100 px-4 text-[13px] font-semibold text-slate-700 hover:bg-slate-200"
          >
            추가
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => set('certified', !value.certified)}
          aria-pressed={value.certified}
          className={`flex h-11 items-center gap-1.5 rounded-xl px-4 text-[13px] font-semibold transition ${
            value.certified ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <ShieldCheck className="size-4" /> 관광통역안내사 자격
        </button>
        <button
          type="button"
          onClick={() => set('active', !value.active)}
          aria-pressed={value.active}
          className={`h-11 rounded-xl px-4 text-[13px] font-semibold transition ${
            value.active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
          }`}
        >
          {value.active ? '활성' : '비활성'}
        </button>
      </div>

      {/* ── 정산·세무 정보 ─────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
        <p className="flex items-center gap-1.5 text-[13px] font-bold text-slate-800">
          <Lock className="size-4 text-slate-500" /> 정산 · 세무 정보
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-slate-500">
          주민등록번호는 사업소득 원천징수와 지급명세서 제출을 위해 소득세법에 따라 수집합니다
          (소득세법 §145·§164). 저장 시 암호화되며 화면에는 마스킹된 값만 표시됩니다.
        </p>

        {!piiKeyConfigured && (
          <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-[12px] font-medium text-amber-800">
            서버에 암호화 키(OPS_GUIDE_PII_ENC_KEY)가 없어 주민번호·계좌는 지금 저장할 수 없습니다.
            나머지 정보는 그대로 저장됩니다.
          </p>
        )}

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="guide-rrn">
              주민등록번호
            </label>
            {rrnMasked && (
              <p className="mb-1 flex items-center gap-2 text-[13px] font-semibold text-slate-700">
                <span className="font-mono">{rrnMasked}</span>
                {onReveal && (
                  <button
                    type="button"
                    onClick={() => onReveal('rrn')}
                    className="rounded-lg bg-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-300"
                  >
                    원문 보기
                  </button>
                )}
              </p>
            )}
            <input
              id="guide-rrn"
              className={`${inputCls} disabled:bg-slate-100 disabled:text-slate-400`}
              value={value.residentNumber}
              disabled={!piiKeyConfigured}
              onChange={(e) => set('residentNumber', e.target.value)}
              placeholder={rrnMasked ? '변경할 때만 입력' : '900101-1234567'}
              autoComplete="off"
              inputMode="numeric"
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="guide-bank-account">
              계좌번호
            </label>
            {bankAccountMasked && (
              <p className="mb-1 flex items-center gap-2 text-[13px] font-semibold text-slate-700">
                <span className="font-mono">{bankAccountMasked}</span>
                {onReveal && (
                  <button
                    type="button"
                    onClick={() => onReveal('bank_account')}
                    className="rounded-lg bg-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-300"
                  >
                    원문 보기
                  </button>
                )}
              </p>
            )}
            <input
              id="guide-bank-account"
              className={`${inputCls} disabled:bg-slate-100 disabled:text-slate-400`}
              value={value.bankAccount}
              disabled={!piiKeyConfigured}
              onChange={(e) => set('bankAccount', e.target.value)}
              placeholder={bankAccountMasked ? '변경할 때만 입력' : '110-123-456789'}
              autoComplete="off"
              inputMode="numeric"
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="guide-bank-name">
              은행
            </label>
            <input
              id="guide-bank-name"
              className={inputCls}
              value={value.bankName}
              onChange={(e) => set('bankName', e.target.value)}
              placeholder="신한은행"
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="guide-bank-holder">
              예금주
            </label>
            <input
              id="guide-bank-holder"
              className={inputCls}
              value={value.bankHolder}
              onChange={(e) => set('bankHolder', e.target.value)}
              placeholder="홍길동"
            />
          </div>
        </div>
      </div>

      <div>
        <label className={labelCls} htmlFor="guide-note">
          메모
        </label>
        <textarea
          id="guide-note"
          className="min-h-[80px] w-full rounded-xl border border-slate-200 bg-white p-3 text-[14px] text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
          value={value.note}
          onChange={(e) => set('note', e.target.value)}
          placeholder="선호 권역, 차량, 특이사항 등"
        />
      </div>
    </div>
  );
}
