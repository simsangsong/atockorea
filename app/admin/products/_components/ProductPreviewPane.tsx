'use client';

import { useMemo, useState } from 'react';
import { Monitor, Smartphone, RotateCw, ExternalLink, X } from 'lucide-react';
import type { Locale } from '../_hooks/types';

type Props = {
  slug: string | null;
  locale: Locale;
  /** Bump this to force the iframe to reload (e.g. after a save). */
  reloadKey: number;
  onClose: () => void;
};

type Viewport = 'desktop' | 'mobile';

/**
 * Right-side live preview pane. Renders the actual customer-facing page in an
 * iframe so the admin sees exactly what the visitor would see. A "reload" key
 * lets the parent force a refresh after `Save`.
 */
export function ProductPreviewPane({ slug, locale, reloadKey, onClose }: Props) {
  const [viewport, setViewport] = useState<Viewport>('desktop');
  const [localReload, setLocalReload] = useState(0);

  const src = useMemo(() => {
    if (!slug) return '';
    // T1: locale is now part of the URL (real `app/[locale]/tour-product/[slug]`
    // routes — `?locale=` is no longer read by the ISR page, and middleware
    // would turn it into a cookie-set redirect). DB locale "zh" maps to the
    // "zh-CN" URL prefix; EN is canonical at the bare path. Freshness after
    // Save comes from the PATCH route's revalidatePath calls — `_v` just
    // forces the iframe element itself to reload.
    const urlLocale = locale === 'zh' ? 'zh-CN' : locale;
    const base =
      urlLocale === 'en' ? `/tour-product/${slug}` : `/${urlLocale}/tour-product/${slug}`;
    const params = new URLSearchParams();
    // cache-bust + force-reload signal
    params.set('_v', String(reloadKey + localReload));
    return `${base}?${params.toString()}`;
  }, [slug, locale, reloadKey, localReload]);

  return (
    <aside className="hidden lg:flex flex-col w-[520px] flex-shrink-0 bg-slate-900 border-l border-slate-200">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 h-12 bg-slate-800 border-b border-slate-700 text-slate-300">
        <span className="text-xs font-semibold text-slate-200">라이브 미리보기</span>
        <span className="text-[10px] font-mono text-slate-400 truncate flex-1">
          {slug ? `/${slug}` : '슬러그 선택'}
        </span>

        <div className="inline-flex rounded-md border border-slate-600 overflow-hidden">
          <button
            type="button"
            onClick={() => setViewport('desktop')}
            className={`px-2 py-1 text-xs flex items-center gap-1 ${
              viewport === 'desktop'
                ? 'bg-slate-700 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
            title="데스크탑"
          >
            <Monitor className="size-3" />
          </button>
          <button
            type="button"
            onClick={() => setViewport('mobile')}
            className={`px-2 py-1 text-xs flex items-center gap-1 ${
              viewport === 'mobile'
                ? 'bg-slate-700 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
            title="모바일"
          >
            <Smartphone className="size-3" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => setLocalReload((n) => n + 1)}
          disabled={!slug}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded disabled:opacity-50"
          title="다시 불러오기"
        >
          <RotateCw className="size-3.5" />
        </button>

        {slug && (
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded"
            title="새 탭에서 열기"
          >
            <ExternalLink className="size-3.5" />
          </a>
        )}

        <button
          type="button"
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded"
          title="미리보기 닫기"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* Frame */}
      <div className="flex-1 overflow-auto bg-slate-900 p-4 flex items-start justify-center">
        {!slug ? (
          <div className="text-slate-500 text-sm mt-12">
            왼쪽에서 상품을 선택하면 미리보기가 표시됩니다.
          </div>
        ) : (
          <div
            className="bg-white rounded-lg shadow-2xl overflow-hidden transition-all duration-300"
            style={{
              width: viewport === 'mobile' ? 390 : '100%',
              maxWidth: viewport === 'mobile' ? 390 : 1280,
              height: viewport === 'mobile' ? 844 : '85vh',
            }}
          >
            <iframe
              key={src}
              src={src}
              className="w-full h-full border-0"
              title={`Preview ${slug}`}
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
            />
          </div>
        )}
      </div>
    </aside>
  );
}
