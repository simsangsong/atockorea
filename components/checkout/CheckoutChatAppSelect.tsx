'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { MYPAGE_FOCUS_RING } from '@/lib/mypage-ui';

const APPS: { value: string; label: string; swatch: string }[] = [
  { value: 'kakao', label: 'KakaoTalk', swatch: 'bg-[#FEE500]' },
  { value: 'line', label: 'LINE', swatch: 'bg-[#06C755]' },
  { value: 'wechat', label: 'WeChat', swatch: 'bg-[#07C160]' },
  { value: 'whatsapp', label: 'WhatsApp', swatch: 'bg-[#25D366]' },
  { value: 'telegram', label: 'Telegram', swatch: 'bg-[#229ED9]' },
  { value: 'other', label: 'Other', swatch: 'bg-slate-400' },
];

function AppIcon({ value, className }: { value: string; className?: string }) {
  const app = APPS.find((a) => a.value === value);
  return (
    <span
      className={cn('inline-block size-4 shrink-0 rounded-md ring-1 ring-black/5', app?.swatch ?? 'bg-slate-300', className)}
      aria-hidden
    />
  );
}

export interface CheckoutChatAppSelectProps {
  value: string;
  onValueChange: (v: string) => void;
  pleaseSelect: string;
  'aria-invalid'?: boolean;
  id?: string;
}

export function CheckoutChatAppSelect({
  value,
  onValueChange,
  pleaseSelect,
  'aria-invalid': ariaInvalid,
  id,
}: CheckoutChatAppSelectProps) {
  return (
    <Select
      value={value === '' ? null : value}
      onValueChange={(v) => onValueChange((v as string) ?? '')}
    >
      <SelectTrigger
        id={id}
        size="default"
        aria-invalid={ariaInvalid}
        className={cn(
          'h-11 w-full min-w-0 max-w-full justify-between gap-2 rounded-2xl border border-slate-200 bg-white py-2.5 pl-3 pr-2 text-left text-[15px] text-slate-900 shadow-none data-placeholder:text-slate-400',
          'hover:bg-slate-50/80',
          ariaInvalid && 'border-red-400 bg-red-50/50',
          MYPAGE_FOCUS_RING,
        )}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
          {value ? <AppIcon value={value} /> : null}
          <SelectValue placeholder={pleaseSelect} />
        </span>
      </SelectTrigger>
      <SelectContent className="z-[100] max-w-[var(--available-width)] rounded-2xl border border-slate-200/80 bg-white p-1 shadow-lg ring-1 ring-slate-900/5">
        {APPS.map((a) => (
          <SelectItem
            key={a.value}
            value={a.value}
            className="cursor-default rounded-xl py-2.5 pl-2 pr-8 text-[14px] data-highlighted:bg-slate-100"
          >
            <span className="flex items-center gap-2.5">
              <AppIcon value={a.value} />
              <span className="font-medium text-slate-900">{a.label}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
