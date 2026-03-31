'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  MANUAL_BOOST_SCORE_MAX,
  MANUAL_BOOST_SCORE_MIN,
  clampManualBoostScore,
} from '@/lib/jeju-poi-admin';
import { adminFetch } from '@/lib/admin-fetch';

type Row = Record<string, unknown>;

type GalleryPhoto = {
  imageUrl?: string | null;
  thumbUrl?: string | null;
  photographyMonth?: string | null;
  photographyLocation?: string | null;
};

type GalleryGroupPayload = {
  galleryGroupTitle?: string;
  matchScore?: number;
  photos?: GalleryPhoto[];
};

function PhotoGalleryReadonlySection({ row }: { row: Row }) {
  const raw = row.photo_gallery_detail_json;
  const fetched = row.photo_gallery_fetched_at;
  if (!raw || typeof raw !== 'object') return null;
  const groups = (raw as { groups?: GalleryGroupPayload[] }).groups;
  if (!Array.isArray(groups) || groups.length === 0) return null;
  let count = 0;
  for (const g of groups) {
    count += Array.isArray(g.photos) ? g.photos.length : 0;
  }
  if (count === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-800">Tour API — 관광사진 (상세)</h2>
        {typeof fetched === 'string' && fetched ? (
          <span className="text-xs text-slate-500 font-mono">fetched {fetched}</span>
        ) : null}
      </div>
      <p className="text-xs text-slate-500">
        <code className="rounded bg-slate-100 px-1">npm run import:jeju:photo-gallery</code> 로 채운 필드입니다
        (읽기 전용).
      </p>
      <div className="space-y-4 max-h-96 overflow-y-auto">
        {groups.map((g: GalleryGroupPayload, gi: number) => (
          <div key={gi} className="space-y-2">
            <p className="text-xs font-medium text-slate-700">
              {g.galleryGroupTitle ?? 'Gallery'}
              {typeof g.matchScore === 'number' ? ` · match ${g.matchScore.toFixed(2)}` : ''}
            </p>
            <div className="flex flex-wrap gap-2">
              {(g.photos ?? []).map((p: GalleryPhoto, pi: number) => {
                const src = (typeof p.imageUrl === 'string' && p.imageUrl) || p.thumbUrl || '';
                if (!src) return null;
                return (
                  <div key={pi} className="w-24 shrink-0 space-y-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt=""
                      className="w-24 h-20 object-cover rounded-lg border border-slate-100"
                    />
                    <p className="text-[10px] text-slate-500 leading-tight line-clamp-2">
                      {[p.photographyMonth, p.photographyLocation].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminPoiEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [row, setRow] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await adminFetch(`/api/admin/pois/${id}`);
        const data = await res.json();
        if (!res.ok) {
          const raw =
            typeof data.message === 'string'
              ? data.message
              : typeof data.error === 'string'
                ? data.error
                : 'Load failed';
          const code = typeof data.code === 'string' ? ` [${data.code}]` : '';
          throw new Error(`${raw}${code}`);
        }
        setRow(data.row);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const save = async () => {
    if (!row) return;
    setSaving(true);
    try {
      const res = await adminFetch(`/api/admin/pois/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_note_ko: row.admin_note_ko,
          admin_note_en: row.admin_note_en,
          admin_short_desc_ko: row.admin_short_desc_ko,
          admin_short_desc_en: row.admin_short_desc_en,
          recommended_duration_min: row.recommended_duration_min,
          manual_priority: row.manual_priority,
          manual_boost_score: clampManualBoostScore(row.manual_boost_score),
          manual_hidden: row.manual_hidden,
          travel_value_score: row.travel_value_score,
          photo_score: row.photo_score,
          senior_score: row.senior_score,
          family_score: row.family_score,
          couple_score: row.couple_score,
          rainy_day_score: row.rainy_day_score,
          route_efficiency_score: row.route_efficiency_score,
          admin_tags: row.admin_tags,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const raw =
          typeof data.message === 'string'
            ? data.message
            : typeof data.error === 'string'
              ? data.error
              : 'Save failed';
        const code = typeof data.code === 'string' ? ` [${data.code}]` : '';
        throw new Error(`${raw}${code}`);
      }
      setRow(data.row);
      toast.success('Saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !row) {
    return <p className="text-slate-600">Loading…</p>;
  }

  const str = (k: string) => String(row[k] ?? '');
  const num = (k: string) => (row[k] == null || row[k] === '' ? '' : String(row[k]));

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/pois" className="text-sm text-blue-600 hover:underline">
          ← Back to list
        </Link>
      </div>
      <h1 className="text-2xl font-semibold text-slate-900">{str('title') || 'POI'}</h1>
      <p className="text-xs text-slate-500 font-mono">
        content_id: {str('content_id')} · type: {str('content_type_id')}
      </p>

      {str('first_image') && (
        <div className="rounded-xl overflow-hidden border border-slate-200 max-w-md">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={str('first_image')} alt="" className="w-full h-48 object-cover" />
        </div>
      )}

      <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-700 whitespace-pre-wrap max-h-48 overflow-y-auto">
        {str('overview') || 'No overview'}
      </div>

      <PhotoGalleryReadonlySection row={row} />

      <div className="grid gap-4">
        <label className="block text-sm">
          <span className="text-slate-600">Admin note (KO)</span>
          <textarea
            className="mt-1 w-full border border-slate-200 rounded-lg p-3 text-sm min-h-[88px]"
            value={str('admin_note_ko')}
            onChange={(e) => setRow({ ...row, admin_note_ko: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-600">Admin note (EN)</span>
          <textarea
            className="mt-1 w-full border border-slate-200 rounded-lg p-3 text-sm min-h-[88px]"
            value={str('admin_note_en')}
            onChange={(e) => setRow({ ...row, admin_note_en: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-600">Short desc (KO)</span>
          <input
            className="mt-1 w-full border border-slate-200 rounded-lg p-2 text-sm"
            value={str('admin_short_desc_ko')}
            onChange={(e) => setRow({ ...row, admin_short_desc_ko: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-600">Short desc (EN)</span>
          <input
            className="mt-1 w-full border border-slate-200 rounded-lg p-2 text-sm"
            value={str('admin_short_desc_en')}
            onChange={(e) => setRow({ ...row, admin_short_desc_en: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-600">Recommended duration (min)</span>
          <input
            type="number"
            className="mt-1 w-full border border-slate-200 rounded-lg p-2 text-sm"
            value={num('recommended_duration_min')}
            onChange={(e) =>
              setRow({
                ...row,
                recommended_duration_min: e.target.value ? parseInt(e.target.value, 10) : null,
              })
            }
          />
        </label>
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(row.manual_hidden)}
            onChange={(e) => setRow({ ...row, manual_hidden: e.target.checked })}
          />
          Hidden from generation
        </label>
        <label className="block text-sm">
          <span className="text-slate-600">manual_priority</span>
          <p className="text-xs text-slate-500 mt-0.5 mb-1">
            Operator ordering / primary rank (batch scoring uses this; unchanged semantics).
          </p>
          <input
            type="number"
            step="0.1"
            className="mt-1 w-full border border-slate-200 rounded-lg p-2 text-sm"
            value={num('manual_priority')}
            onChange={(e) => setRow({ ...row, manual_priority: parseFloat(e.target.value) || 0 })}
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-600">manual_boost_score</span>
          <p className="text-xs text-slate-500 mt-0.5 mb-1">
            Additive push for itinerary candidate ranking ({MANUAL_BOOST_SCORE_MIN}–{MANUAL_BOOST_SCORE_MAX});
            does not replace manual_priority.
          </p>
          <input
            type="number"
            min={MANUAL_BOOST_SCORE_MIN}
            max={MANUAL_BOOST_SCORE_MAX}
            step="1"
            className="mt-1 w-full border border-slate-200 rounded-lg p-2 text-sm"
            value={num('manual_boost_score')}
            onChange={(e) =>
              setRow({
                ...row,
                manual_boost_score: clampManualBoostScore(
                  e.target.value === '' ? 0 : parseFloat(e.target.value),
                ),
              })
            }
          />
        </label>
        {(
          [
            'travel_value_score',
            'photo_score',
            'senior_score',
            'family_score',
            'couple_score',
            'rainy_day_score',
            'route_efficiency_score',
          ] as const
        ).map((k) => (
          <label key={k} className="block text-sm">
            <span className="text-slate-600">{k}</span>
            <input
              type="number"
              step="0.1"
              className="mt-1 w-full border border-slate-200 rounded-lg p-2 text-sm"
              value={num(k)}
              onChange={(e) =>
                setRow({
                  ...row,
                  [k]: e.target.value === '' ? null : parseFloat(e.target.value),
                })
              }
            />
          </label>
        ))}
        <label className="block text-sm">
          <span className="text-slate-600">Tags (comma-separated)</span>
          <input
            className="mt-1 w-full border border-slate-200 rounded-lg p-2 text-sm"
            value={
              Array.isArray(row.admin_tags) ? (row.admin_tags as string[]).join(', ') : str('admin_tags')
            }
            onChange={(e) =>
              setRow({
                ...row,
                admin_tags: e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
          />
        </label>
      </div>

      <button
        type="button"
        disabled={saving}
        onClick={save}
        className="px-6 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  );
}
