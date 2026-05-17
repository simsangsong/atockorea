'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/admin/analytics/product', label: '개요' },
  { href: '/admin/analytics/product/events', label: '이벤트' },
  { href: '/admin/analytics/product/funnels', label: '펀널' },
  { href: '/admin/analytics/product/retention', label: '리텐션' },
  { href: '/admin/analytics/product/sessions', label: '세션' },
  { href: '/admin/analytics/product/experiments', label: 'A/B 실험' },
  { href: '/admin/analytics/product/health', label: '수집 헬스' },
];

export default function AnalyticsProductLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 md:text-2xl">프로덕트 분석</h1>
        <p className="mt-1 text-sm text-slate-600">
          이벤트 수집 / 펀널 / 리텐션 / A/B 측정 — 자체 빌드 (Phase 1 Foundation).
        </p>
      </div>

      <div className="border-b border-slate-200">
        <nav className="-mb-px flex flex-wrap gap-1 overflow-x-auto" aria-label="Tabs">
          {tabs.map((tab) => {
            const active =
              tab.href === '/admin/analytics/product'
                ? pathname === tab.href
                : pathname?.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={
                  'whitespace-nowrap rounded-t-md border-b-2 px-3 py-2 text-sm font-medium transition-colors ' +
                  (active
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-800')
                }
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div>{children}</div>
    </div>
  );
}
