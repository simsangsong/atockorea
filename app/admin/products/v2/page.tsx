'use client';

/**
 * V2 admin product editor — Phase 2 redesign.
 *
 * Three-pane layout (list / editor / live preview) with:
 *   - List pane: search + city/status filters + thumbnails
 *   - Editor pane: locale switcher, sticky save bar, sonner toasts,
 *     basic-info + SEO sections (more sections land in 2-A2/2-A3)
 *   - Preview pane: iframe of the actual /tour-product/<slug> page,
 *     desktop/mobile toggle, force-reload after save
 *
 * Data flows through plain hooks (no react-query yet). Each save bumps a
 * `reloadKey` so the iframe re-fetches the freshly-saved page.
 */

import { useCallback, useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { ProductsListPane } from './_components/ProductsListPane';
import { ProductEditorPane } from './_components/ProductEditorPane';
import { ProductPreviewPane } from './_components/ProductPreviewPane';
import { useProductsList } from './_hooks/useProductsList';
import { useProductPage } from './_hooks/useProductPage';
import type { Locale, ProductPageRow } from './_hooks/types';

const LOCALE_STORAGE_KEY = 'admin.products.v2.locale';
const PREVIEW_STORAGE_KEY = 'admin.products.v2.previewOpen';

function readStoredLocale(): Locale {
  if (typeof window === 'undefined') return 'ko';
  const v = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  return (v as Locale) || 'ko';
}

function readStoredPreviewOpen(): boolean {
  if (typeof window === 'undefined') return true;
  const v = window.localStorage.getItem(PREVIEW_STORAGE_KEY);
  return v === null ? true : v === '1';
}

export default function ProductsV2Page() {
  const list = useProductsList();
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [locale, setLocale] = useState<Locale>('ko');
  const [previewOpen, setPreviewOpen] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  // Restore persisted UI preferences
  useEffect(() => {
    setLocale(readStoredLocale());
    setPreviewOpen(readStoredPreviewOpen());
  }, []);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    }
  }, [locale]);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(PREVIEW_STORAGE_KEY, previewOpen ? '1' : '0');
    }
  }, [previewOpen]);

  // Auto-select first tour on load
  useEffect(() => {
    if (!selectedSlug && list.items.length > 0) {
      setSelectedSlug(list.items[0].slug);
    }
  }, [list.items, selectedSlug]);

  const page = useProductPage(selectedSlug, locale);

  const onSaved = useCallback(
    (next: ProductPageRow) => {
      page.setData(next);
      setReloadKey((n) => n + 1);
      // Refresh list so any thumbnail/title changes show up
      void list.refresh();
    },
    [page, list],
  );

  return (
    <div className="-m-6 h-[calc(100vh-3.5rem)] flex bg-slate-50">
      {/* List pane */}
      <ProductsListPane
        items={list.items}
        loading={list.loading}
        error={list.error}
        selectedSlug={selectedSlug}
        onSelect={setSelectedSlug}
        onRefresh={list.refresh}
      />

      {/* Editor pane */}
      {selectedSlug ? (
        <ProductEditorPane
          slug={selectedSlug}
          row={page.data}
          loading={page.loading}
          error={page.error}
          fallbackLocale={page.fallbackLocale}
          locale={locale}
          onLocaleChange={setLocale}
          onSaved={onSaved}
          onTogglePreview={() => setPreviewOpen((p) => !p)}
          previewOpen={previewOpen}
          onBackToList={() => setSelectedSlug(null)}
        />
      ) : (
        <EmptyEditorPane />
      )}

      {/* Preview pane */}
      {previewOpen && (
        <ProductPreviewPane
          slug={selectedSlug}
          locale={locale}
          reloadKey={reloadKey}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
}

function EmptyEditorPane() {
  return (
    <section className="flex-1 flex flex-col items-center justify-center bg-slate-50 px-6">
      <div className="w-16 h-16 mb-4 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
        <Sparkles className="size-8 text-white" />
      </div>
      <h2 className="text-lg font-semibold text-slate-900 mb-1">상품 관리 v2</h2>
      <p className="text-sm text-slate-500 mb-4 max-w-md text-center">
        왼쪽에서 상품을 선택하면 편집기와 라이브 미리보기가 함께 열립니다.
      </p>
    </section>
  );
}
