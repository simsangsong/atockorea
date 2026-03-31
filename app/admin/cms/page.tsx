'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import ImageUploader from '@/components/admin/ImageUploader';
import { locales, localeLabels, type Locale } from '@/lib/locale';
import {
  CMS_PAGE_BUNDLES,
  CMS_PAGE_BUNDLE_IDS,
  type CmsPageBundleId,
} from '@/lib/cms-page-bundles';
import { DEFAULT_CMS_SECTION_IMAGES } from '@/lib/cms-defaults';
import { DEFAULT_HOMEPAGE_PRODUCT_CARD_IMAGES } from '@/lib/homepage-product-card-images.shared';

const SECTION_KEYS = [
  { key: 'hero.feature', label: '랜딩 히어로 대형 이미지 (hero.feature)' },
] as const;

export default function AdminCmsPage() {
  const router = useRouter();
  const fileImportRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [sectionUrls, setSectionUrls] = useState<Record<string, string>>({});
  const [productCards, setProductCards] = useState<{ join: string; private: string; bus: string }>({
    join: '',
    private: '',
    bus: '',
  });
  const [exportLocale, setExportLocale] = useState<Locale | 'all'>('all');
  /** 비어 있으면 전체 키; 지정 시 해당 화면에 쓰는 messages/siteCopy 최상위 키만 */
  const [exportPageBundle, setExportPageBundle] = useState<'' | CmsPageBundleId>('');
  /** 추출 API 응답 (편집·복사 가능) */
  const [exportJsonText, setExportJsonText] = useState('');
  /** DB에 적용할 JSON (붙여넣기) */
  const [importJsonText, setImportJsonText] = useState('');
  /**
   * 영어 추출본(en만) 번역 후 적용 시: 대상 언어 선택 → 서버가 messages.en → messages.ko 등으로 매핑.
   * 빈 값이면 JSON에 있는 로케일 키 그대로 적용.
   */
  const [applyImportLocale, setApplyImportLocale] = useState<'' | Locale>('');
  /** 적용 시 서버가 해당 페이지 번들 키만 반영 (?page=) */
  const [applyImportPageBundle, setApplyImportPageBundle] = useState<'' | CmsPageBundleId>('');
  /** true면 sectionImages 병합 생략(문구·siteCopy만) — 영어 번역본만 넣을 때 체크 권장 */
  const [skipSectionImagesImport, setSkipSectionImagesImport] = useState(false);

  const authHeaders = async () => {
    const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } };
    if (!session) return null;
    return { Authorization: `Bearer ${session.access_token}` };
  };

  const loadState = async () => {
    const h = await authHeaders();
    if (!h) {
      router.push('/signin?redirect=/admin/cms');
      return;
    }
    const [cmsRes, imgRes] = await Promise.all([
      fetch('/api/admin/cms', { headers: h, credentials: 'include' }),
      fetch('/api/admin/homepage-product-card-images', { headers: h, credentials: 'include' }),
    ]);
    if (cmsRes.status === 403) {
      alert('관리자 권한이 필요합니다.');
      router.push('/');
      return;
    }
    if (cmsRes.ok) {
      const j = await cmsRes.json();
      const si = j?.overrides?.sectionImages as Record<string, string> | undefined;
      setSectionUrls(si ? { ...si } : {});
    }
    if (imgRes.ok) {
      const j = await imgRes.json();
      if (j.success && j.data) {
        setProductCards({
          join: j.data.join ?? '',
          private: j.data.private ?? '',
          bus: j.data.bus ?? '',
        });
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    loadState();
  }, []);

  /** 페이지 번들에 맞춰 이미지 병합 체크 기본값(메인만 이미지 가능) */
  useEffect(() => {
    if (applyImportPageBundle === 'main') {
      setSkipSectionImagesImport(false);
    } else if (applyImportPageBundle) {
      setSkipSectionImagesImport(true);
    }
  }, [applyImportPageBundle]);

  const fetchExportJsonString = async (): Promise<{ text: string; filename: string }> => {
    const h = await authHeaders();
    if (!h) throw new Error('로그인이 필요합니다.');
    const params = new URLSearchParams();
    if (exportLocale !== 'all') params.set('locale', exportLocale);
    if (exportPageBundle) params.set('page', exportPageBundle);
    const q = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`/api/admin/cms/export${q}`, { headers: h, credentials: 'include' });
    if (!res.ok) throw new Error('추출 요청 실패');
    const text = await res.text();
    const cd = res.headers.get('Content-Disposition');
    const m = cd?.match(/filename="([^"]+)"/);
    const filename = m?.[1] ?? 'atockorea-cms-export.json';
    return { text, filename };
  };

  /** 추출 → 출력창 */
  const loadExportToOutput = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const { text } = await fetchExportJsonString();
      try {
        const parsed = JSON.parse(text);
        setExportJsonText(JSON.stringify(parsed, null, 2));
      } catch {
        setExportJsonText(text);
      }
      setStatus('출력창에 추출 JSON을 불러왔습니다.');
    } catch (e: unknown) {
      setStatus(e instanceof Error ? e.message : '오류');
    } finally {
      setBusy(false);
    }
  };

  /** 추출 → 파일 다운로드 */
  const downloadExport = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const { text, filename } = await fetchExportJsonString();
      const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setStatus('JSON 파일이 다운로드되었습니다.');
    } catch (e: unknown) {
      setStatus(e instanceof Error ? e.message : '오류');
    } finally {
      setBusy(false);
    }
  };

  const postImportBody = async (text: string) => {
    const h = await authHeaders();
    if (!h) return;
    const qs = new URLSearchParams();
    if (applyImportLocale) qs.set('applyLocale', applyImportLocale);
    if (applyImportPageBundle) qs.set('page', applyImportPageBundle);
    if (skipSectionImagesImport) qs.set('skipSectionImages', '1');
    const q = qs.toString();
    const res = await fetch(`/api/admin/cms/import${q ? `?${q}` : ''}`, {
      method: 'POST',
      headers: { ...h, 'Content-Type': 'application/json' },
      credentials: 'include',
      body: text,
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || '적용 실패');
    setStatus('가져오기가 적용되었습니다. 사이트를 새로고침하면 반영됩니다.');
    await loadState();
  };

  /** 입력창 내용 적용 */
  const applyImportFromInput = async () => {
    const text = importJsonText.trim();
    if (!text) {
      setStatus('적용할 JSON을 입력창에 붙여넣어 주세요.');
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      JSON.parse(text);
      await postImportBody(text);
    } catch (e: unknown) {
      if (e instanceof SyntaxError) {
        setStatus('JSON 형식이 올바르지 않습니다.');
      } else {
        setStatus(e instanceof Error ? e.message : '오류');
      }
    } finally {
      setBusy(false);
    }
  };

  const onPickImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setStatus(null);
    try {
      const text = await file.text();
      setImportJsonText(text);
      try {
        const parsed = JSON.parse(text);
        setImportJsonText(JSON.stringify(parsed, null, 2));
      } catch {
        /* keep raw */
      }
      setStatus('파일 내용을 입력창에 불러왔습니다. 필요하면 수정 후 「입력 내용 적용」을 누르세요.');
    } catch (e: unknown) {
      setStatus(e instanceof Error ? e.message : '오류');
    } finally {
      setBusy(false);
    }
  };

  const saveSectionImages = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const h = await authHeaders();
      if (!h) return;
      const sectionImages: Record<string, string | null> = {};
      for (const { key } of SECTION_KEYS) {
        const v = sectionUrls[key]?.trim();
        sectionImages[key] = v || null;
      }
      const res = await fetch('/api/admin/cms/section-images', {
        method: 'PUT',
        headers: { ...h, 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sectionImages }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || '저장 실패');
      setStatus('섹션 이미지가 저장되었습니다.');
    } catch (e: unknown) {
      setStatus(e instanceof Error ? e.message : '오류');
    } finally {
      setBusy(false);
    }
  };

  const saveProductCards = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const h = await authHeaders();
      if (!h) return;
      const res = await fetch('/api/admin/homepage-product-card-images', {
        method: 'PUT',
        headers: { ...h, 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          join: productCards.join || null,
          private: productCards.private || null,
          bus: productCards.bus || null,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || '저장 실패');
      setStatus('홈 카드 이미지가 저장되었습니다.');
    } catch (e: unknown) {
      setStatus(e instanceof Error ? e.message : '오류');
    } finally {
      setBusy(false);
    }
  };

  /** 업로드 직후 DB에 병합 저장 — 「섹션 이미지 저장」을 누르지 않아도 반영되게 함 */
  const applyUploadedUrl = async (key: string, urls: string[]) => {
    const url = urls[0]?.trim();
    if (!url) return;
    setSectionUrls((prev) => ({ ...prev, [key]: url }));
    setBusy(true);
    setStatus(null);
    try {
      const h = await authHeaders();
      if (!h) {
        setStatus('로그인이 필요합니다.');
        return;
      }
      const res = await fetch('/api/admin/cms/section-images', {
        method: 'PUT',
        headers: { ...h, 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sectionImages: { [key]: url } }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || '저장 실패');
      setStatus('업로드한 URL을 저장했습니다. 홈에서 새로고침(F5)하면 보입니다.');
    } catch (e: unknown) {
      setStatus(e instanceof Error ? e.message : '오류');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-gray-600">
        불러오는 중…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">페이지 편집 (CMS)</h1>
          <p className="text-gray-600 mt-2 max-w-3xl">
            랜딩을 포함한 UI 문자열은 <code className="text-sm bg-gray-100 px-1 rounded">messages/*.json</code>·
            <code className="text-sm bg-gray-100 px-1 rounded">messages/siteCopy/*.json</code> 기준과 DB 오버라이드를 합쳐
            표시합니다. <strong>히어로 대형 이미지·상품 카드 배경</strong>은 아래 첫 두 블록에서 URL 입력 또는 업로드로 바꿀 수 있고,
            문자열은 그 아래 JSON으로 추출·적용합니다.
          </p>
        </div>

        {status && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            {status}
          </div>
        )}

        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">랜딩 · 섹션 이미지</h2>
          <p className="text-sm text-gray-600">
            히어로 하단 큰 비주얼 카드( JOIN TOUR / AI-PLANNED 등) 배경은 키{' '}
            <code className="text-xs bg-gray-100 px-1 rounded">hero.feature</code>로 저장됩니다. URL은{' '}
            <code className="text-xs bg-gray-100 px-1 rounded">/</code>로 시작하거나 http(s) 주소여야 합니다. 비우면 기본
            이미지로 돌아갑니다.
          </p>

          {SECTION_KEYS.map(({ key, label }) => (
            <div key={key} className="border border-gray-100 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium text-gray-800">{label}</p>
              <p className="text-xs text-gray-500">
                기본값: {DEFAULT_CMS_SECTION_IMAGES[key] ?? '(없음)'}
              </p>
              <input
                type="text"
                value={sectionUrls[key] ?? ''}
                onChange={(e) => setSectionUrls((prev) => ({ ...prev, [key]: e.target.value }))}
                placeholder="이미지 URL"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <ImageUploader
                onUploadComplete={(urls) => void applyUploadedUrl(key, urls)}
                multiple={false}
                type="product"
                folder="cms/sections"
              />
            </div>
          ))}

          <button
            type="button"
            disabled={busy}
            onClick={saveSectionImages}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
          >
            섹션 이미지 저장
          </button>
        </section>

        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">홈 — 상품 카드 배경 (Join / Private / Bus)</h2>
          <p className="text-xs text-gray-500">
            기본: join {DEFAULT_HOMEPAGE_PRODUCT_CARD_IMAGES.join.slice(0, 48)}…
          </p>
          <div className="grid gap-6 md:grid-cols-3">
            {(['join', 'private', 'bus'] as const).map((k) => (
              <div key={k} className="space-y-2 rounded-lg border border-gray-100 p-3">
                <label className="text-sm font-medium text-gray-700">
                  {k === 'join' ? '조인 투어' : k === 'private' ? '프라이빗' : '버스'} 카드
                </label>
                <input
                  type="text"
                  value={productCards[k]}
                  onChange={(e) => setProductCards((p) => ({ ...p, [k]: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <ImageUploader
                  onUploadComplete={(urls) => {
                    if (urls[0]) setProductCards((p) => ({ ...p, [k]: urls[0] }));
                  }}
                  multiple={false}
                  type="product"
                  folder="homepage/cards"
                />
              </div>
            ))}
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={saveProductCards}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            카드 이미지 저장
          </button>
        </section>

        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">문자열 JSON (추출 / 적용)</h2>
            <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1">
            <li>
              추출: 저장소 + DB 합본 JSON입니다. <strong>페이지</strong>에서 메인·마이페이지·약관 등으로 좁히면 해당 화면에 쓰는 키만 나옵니다. 영어 원본만 쓰려면 범위를 <strong>English</strong>로 하세요.
            </li>
            <li>적용: 번역한 JSON을 입력창에 넣고, <strong>적용할 언어</strong>를 맞추면 <code className="text-xs bg-gray-100 px-1 rounded">messages.en</code>만 있어도 해당 언어로 저장됩니다.</li>
            <li>이미지 URL은 전역이라, 문구만 바꿀 때는 「이미지 이번에 적용 안 함」을 켜세요.</li>
          </ol>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">추출 범위 (언어)</label>
              <select
                value={exportLocale}
                onChange={(e) => setExportLocale(e.target.value as Locale | 'all')}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="all">전체 언어</option>
                {locales.map((loc) => (
                  <option key={loc} value={loc}>
                    {localeLabels[loc]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">페이지 (선택)</label>
              <select
                value={exportPageBundle}
                onChange={(e) => setExportPageBundle((e.target.value || '') as '' | CmsPageBundleId)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm min-w-[14rem]"
              >
                <option value="">전체 (모든 키)</option>
                {CMS_PAGE_BUNDLE_IDS.map((id) => (
                  <option key={id} value={id}>
                    {CMS_PAGE_BUNDLES[id].labelKo}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={loadExportToOutput}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              추출 → 출력창
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={downloadExport}
              className="px-4 py-2 rounded-lg bg-blue-100 text-blue-900 text-sm font-medium hover:bg-blue-200 disabled:opacity-50"
            >
              파일로 다운로드
            </button>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <label className="text-sm font-medium text-gray-800">출력 (추출 결과 JSON)</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!exportJsonText}
                  onClick={() => {
                    setImportJsonText(exportJsonText);
                    setStatus('출력 내용을 입력창으로 옮겼습니다. 수정 후 「입력 내용 적용」을 누르세요.');
                  }}
                  className="text-xs text-gray-700 hover:underline disabled:opacity-40"
                >
                  출력 → 입력
                </button>
                <button
                  type="button"
                  disabled={!exportJsonText}
                  onClick={() => {
                    void navigator.clipboard.writeText(exportJsonText);
                    setStatus('출력 내용을 클립보드에 복사했습니다.');
                  }}
                  className="text-xs text-blue-600 hover:underline disabled:opacity-40"
                >
                  전체 복사
                </button>
              </div>
            </div>
            <textarea
              value={exportJsonText}
              onChange={(e) => setExportJsonText(e.target.value)}
              spellCheck={false}
              placeholder='위에서 「추출 → 출력창」을 누르면 여기에 표시됩니다.'
              className="w-full min-h-[220px] rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs leading-relaxed text-gray-900 bg-gray-50/80"
            />
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
              <label className="text-sm font-medium text-gray-800">입력 (적용할 JSON)</label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => fileImportRef.current?.click()}
                  className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  파일에서 불러오기
                </button>
                <input
                  ref={fileImportRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={onPickImportFile}
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={applyImportFromInput}
                  className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 text-white font-medium hover:bg-slate-900 disabled:opacity-50"
                >
                  입력 내용 적용
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-600 mb-2">
              <strong>적용할 페이지</strong>와 <strong>적용할 언어</strong>를 맞추면, 그 화면에 해당하는 키만 반영하고
              영어 원본만 있는 JSON도 선택 언어로 저장할 수 있습니다. 추출할 때와 같은 페이지를 고르면 안전합니다.
            </p>
            <div className="flex flex-wrap items-end gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-0.5">적용할 페이지</label>
                <select
                  value={applyImportPageBundle}
                  onChange={(e) => setApplyImportPageBundle((e.target.value || '') as '' | CmsPageBundleId)}
                  className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm min-w-[14rem]"
                >
                  <option value="">전체 (JSON에 있는 키 그대로)</option>
                  {CMS_PAGE_BUNDLE_IDS.map((id) => (
                    <option key={id} value={id}>
                      {CMS_PAGE_BUNDLES[id].labelKo}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-0.5">적용할 언어</label>
                <select
                  value={applyImportLocale}
                  onChange={(e) => setApplyImportLocale((e.target.value || '') as '' | Locale)}
                  className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm min-w-[11rem]"
                >
                  <option value="">자동 (JSON 키 그대로)</option>
                  {locales.map((loc) => (
                    <option key={loc} value={loc}>
                      → {localeLabels[loc]} ({loc})
                    </option>
                  ))}
                </select>
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none pb-0.5">
                <input
                  type="checkbox"
                  checked={skipSectionImagesImport}
                  onChange={(e) => setSkipSectionImagesImport(e.target.checked)}
                  className="rounded border-gray-300"
                />
                이미지(sectionImages) 이번에 적용 안 함
              </label>
            </div>
            <p className="text-xs text-gray-500 mb-2">
              <strong>적용할 언어</strong>를 고르면 <code className="bg-gray-100 px-0.5 rounded">messages.en</code>만
              있어도 선택한 언어(예: 한국어)로 저장됩니다. <strong>적용할 페이지</strong>를 고르면 그 화면에
              허용된 messages/siteCopy 키만 적용하고, 메인이 아닌 번들은 이미지 병합을 생략합니다.
            </p>
            <textarea
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              spellCheck={false}
              placeholder="편집한 JSON을 붙여넣거나, 「파일에서 불러오기」로 채운 뒤 적용하세요."
              className="w-full min-h-[220px] rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs leading-relaxed text-gray-900"
            />
          </div>
        </section>
      </div>
    </div>
  );
}
