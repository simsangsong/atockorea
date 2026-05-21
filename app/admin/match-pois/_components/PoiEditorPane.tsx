'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Save,
  Loader2,
  Hash,
  ArrowLeft,
  Pin,
  AlertTriangle,
  Sparkles,
  Lock,
} from 'lucide-react';
import { REGION_CLUSTER } from '@/lib/itinerary-builder/regions';
import { emptyPoiRow, pickEditable, type PoiRow } from '../_hooks/types';
import { savePoi } from '../_hooks/usePoiRow';

type Props = {
  poiKey: string;
  initialRow: PoiRow | null;
  isNew: boolean;
  onSaved: (row: PoiRow, created: boolean) => void;
  onBackToList: () => void;
};

export function PoiEditorPane({ poiKey, initialRow, isNew, onSaved, onBackToList }: Props) {
  const seed = initialRow ?? emptyPoiRow(poiKey);
  const [baseline, setBaseline] = useState<PoiRow>(seed);
  const [draft, setDraft] = useState<PoiRow>(seed);
  const [rev, setRev] = useState(0); // bumps after save → remounts buffered sub-fields
  const [invalidFields, setInvalidFields] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [newBadge, setNewBadge] = useState(isNew);

  const dirty = JSON.stringify(pickEditable(draft)) !== JSON.stringify(pickEditable(baseline));
  const hasInvalidJson = Object.values(invalidFields).some(Boolean);
  const canSave = dirty && !hasInvalidJson && !saving;

  const set = <K extends keyof PoiRow>(key: K, value: PoiRow[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const setValidity = (field: string, valid: boolean) =>
    setInvalidFields((prev) => {
      if (Boolean(prev[field]) === !valid) return prev;
      return { ...prev, [field]: !valid };
    });

  const onSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const { row, created, message } = await savePoi(poiKey, draft);
      setBaseline(row);
      setDraft(row);
      setRev((r) => r + 1);
      setInvalidFields({});
      setNewBadge(false);
      onSaved(row, created);
      toast.success(created ? 'POI 생성됨' : '저장되었습니다', { description: `${poiKey} · ${message}` });
    } catch (e) {
      toast.error('저장 실패', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(false);
    }
  };

  const overridePinned = Boolean(baseline.override_pinned);
  const resetKey = String(rev);

  return (
    <section className="flex flex-col flex-1 min-w-0 bg-slate-50">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-5 py-3 flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={onBackToList}
          className="lg:hidden p-1.5 rounded-md text-slate-600 hover:bg-slate-100"
          title="목록으로"
        >
          <ArrowLeft className="size-4" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Hash className="size-3" />
            <span className="font-mono truncate">{poiKey}</span>
            {newBadge && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 rounded">
                새 POI
              </span>
            )}
            {overridePinned && (
              <span
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200 rounded"
                title="이미지가 override map에 고정됨 — 재시드 시 우선 적용"
              >
                <Pin className="size-2.5" /> override-pinned
              </span>
            )}
          </div>
          <h1 className="text-base font-semibold text-slate-900 truncate">
            {draft.name_en || poiKey}
          </h1>
        </div>

        <button
          type="button"
          onClick={onSave}
          disabled={!canSave}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
            canSave
              ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}
        >
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
          {saving ? '저장 중...' : dirty ? '저장 (upsert)' : '저장됨'}
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-5">
        {hasInvalidJson && (
          <div className="mb-4 px-3 py-2 rounded-md border border-rose-200 bg-rose-50 text-rose-800 text-xs flex items-center gap-2">
            <AlertTriangle className="size-3.5 flex-shrink-0" />
            JSON 형식 오류가 있는 필드가 있어 저장할 수 없습니다. 빨간 표시된 필드를 확인하세요.
          </div>
        )}

        <div key={resetKey} className="space-y-4 max-w-3xl">
          {/* Read-only meta */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
            <span className="inline-flex items-center gap-1">
              <Lock className="size-3" /> is_operational:{' '}
              <span className="font-mono text-slate-500">{String(baseline.is_operational ?? false)}</span>
            </span>
            {baseline.updated_at && <span>updated: {new Date(baseline.updated_at).toLocaleString()}</span>}
            {baseline.created_at && <span>created: {new Date(baseline.created_at).toLocaleString()}</span>}
          </div>

          {/* ── Identity ── */}
          <Card title="Identity" subtitle="이름 · 분류">
            <TextField label="name_en" value={draft.name_en} onChange={(v) => set('name_en', v)} />
            <TextField label="name_ko" value={draft.name_ko} onChange={(v) => set('name_ko', v)} />
            <NamesOtherLocales value={draft.names_other_locales} onChange={(v) => set('names_other_locales', v)} />
            <div className="grid grid-cols-2 gap-3">
              <TextField label="category" value={draft.category} onChange={(v) => set('category', v)} />
              <TextField label="stop_role" value={draft.stop_role} onChange={(v) => set('stop_role', v)} />
            </div>
            <Toggle
              label="is_attraction"
              value={draft.is_attraction}
              onChange={(v) => set('is_attraction', v)}
            />
          </Card>

          {/* ── Location ── */}
          <Card title="Location" subtitle="지역 · 좌표 · 체류시간">
            <Field label="region" hint={`부산권: ${REGION_CLUSTER.busan.join(', ')} · 제주: ${REGION_CLUSTER.jeju.join(', ')}`}>
              <input
                type="text"
                list="match-poi-regions"
                value={draft.region ?? ''}
                onChange={(e) => set('region', e.target.value === '' ? null : e.target.value)}
                className={inputCls}
              />
              <datalist id="match-poi-regions">
                {[...REGION_CLUSTER.busan, ...REGION_CLUSTER.jeju, 'seoul', 'gyeonggi', 'gangwon', 'incheon'].map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                label="lat"
                value={draft.lat}
                onChange={(v) => set('lat', v)}
                min={33.0}
                max={38.7}
                hint="33.0–38.7"
              />
              <NumberField
                label="lng"
                value={draft.lng}
                onChange={(v) => set('lng', v)}
                min={124.6}
                max={131.0}
                hint="124.6–131.0"
              />
            </div>
            <NumberField
              label="default_stay_minutes"
              value={draft.default_stay_minutes}
              onChange={(v) => set('default_stay_minutes', v)}
              integer
              min={0}
            />
          </Card>

          {/* ── Image ── */}
          <Card title="Image" subtitle="대표 이미지 · 갤러리">
            {overridePinned && (
              <div className="px-3 py-2 rounded-md border border-amber-200 bg-amber-50 text-amber-800 text-xs flex items-start gap-2">
                <Pin className="size-3.5 flex-shrink-0 mt-0.5" />
                <span>
                  이 POI는 <strong>override map</strong>에 고정되어 있습니다. 여기서 이미지를 바꿔도{' '}
                  <strong>재시드(re-seed)</strong> 시 override map 값이 우선 적용됩니다.
                </span>
              </div>
            )}
            <Field label="default_image_url">
              <input
                type="text"
                value={draft.default_image_url ?? ''}
                onChange={(e) => set('default_image_url', e.target.value === '' ? null : e.target.value)}
                className={inputCls}
              />
            </Field>
            {draft.default_image_url && (
              <div className="rounded-md overflow-hidden border border-slate-200 bg-slate-100 max-w-xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={draft.default_image_url}
                  alt={draft.name_en || poiKey}
                  className="w-full aspect-video object-cover"
                  loading="lazy"
                />
              </div>
            )}
            <StringListField
              label="images (갤러리)"
              hint="한 줄에 이미지 URL 하나씩"
              value={draft.images}
              onChange={(v) => set('images', v)}
            />
          </Card>

          {/* ── Content ── */}
          <Card title="Content" subtitle="설명 · 하이라이트 · 구조화 정보">
            <TextArea label="description" rows={4} value={draft.description} onChange={(v) => set('description', v)} />
            <StringListField
              label="highlights"
              hint="한 줄에 하나씩"
              value={draft.highlights}
              onChange={(v) => set('highlights', v)}
            />
            <TextArea label="why_on_route" rows={2} value={draft.why_on_route} onChange={(v) => set('why_on_route', v)} />
            <JsonField
              label="content_locales"
              hint="JSON object · locale별 rich stop copy"
              value={draft.content_locales}
              onChange={(v) => set('content_locales', v as PoiRow['content_locales'])}
              onValidity={(ok) => setValidity('content_locales', ok)}
            />
            <JsonField
              label="visit_basics"
              hint="JSON object · 빈 {} 는 저장 시 null 처리"
              value={draft.visit_basics}
              onChange={(v) => set('visit_basics', v as PoiRow['visit_basics'])}
              onValidity={(ok) => setValidity('visit_basics', ok)}
            />
            <JsonField
              label="convenience"
              hint="JSON object · 빈 {} 는 저장 시 null 처리"
              value={draft.convenience}
              onChange={(v) => set('convenience', v as PoiRow['convenience'])}
              onValidity={(ok) => setValidity('convenience', ok)}
            />
            <JsonField
              label="smart_notes"
              hint="JSON object · 빈 {} 는 저장 시 null 처리"
              value={draft.smart_notes}
              onChange={(v) => set('smart_notes', v as PoiRow['smart_notes'])}
              onValidity={(ok) => setValidity('smart_notes', ok)}
            />
          </Card>

          {/* ── Matching profile ── */}
          <Card title="Matching profile" subtitle="매칭 프로파일 · 메타">
            <JsonField
              label="matching_profile"
              hint="JSON object (차원별 0–5 점수 등)"
              value={draft.matching_profile}
              onChange={(v) => set('matching_profile', v as PoiRow['matching_profile'])}
              onValidity={(ok) => setValidity('matching_profile', ok)}
            />
            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="builder_profile_source"
                value={draft.builder_profile_source}
                onChange={(v) => set('builder_profile_source', v)}
              />
              <NumberField
                label="builder_profile_version"
                value={draft.builder_profile_version}
                onChange={(v) => set('builder_profile_version', v)}
                integer
                min={0}
              />
            </div>
            <TextField label="kb_version" value={draft.kb_version} onChange={(v) => set('kb_version', v)} />
            <JsonField
              label="poi_meta"
              hint="JSON object · NOT NULL (비울 수 없음 — 기존 값 유지)"
              value={draft.poi_meta}
              onChange={(v) => set('poi_meta', v as PoiRow['poi_meta'])}
              onValidity={(ok) => setValidity('poi_meta', ok)}
            />
          </Card>

          <div className="flex items-center gap-2 text-[11px] text-slate-400 pb-2">
            <Sparkles className="size-3" />
            저장은 auto-upsert (onConflict: poi_key) — 새 key는 INSERT, 기존 key는 UPDATE.
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── shared input styles ── */
const inputCls =
  'w-full h-9 px-2.5 text-sm rounded-md border border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none';
const textareaCls =
  'w-full px-2.5 py-1.5 text-sm rounded-md border border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none resize-y';

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
      <div className="px-4 py-3 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
      <div className="p-4 space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1 gap-2">
        <span className="text-xs font-medium text-slate-700 font-mono">{label}</span>
        {hint && <span className="text-[10px] text-slate-400 text-right">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  return (
    <Field label={label}>
      <input
        type="text"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
        className={inputCls}
      />
    </Field>
  );
}

function TextArea({
  label,
  rows,
  value,
  onChange,
}: {
  label: string;
  rows: number;
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  return (
    <Field label={label}>
      <textarea
        rows={rows}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
        className={textareaCls}
      />
    </Field>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium text-slate-700 font-mono">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          value ? 'bg-blue-600' : 'bg-slate-300'
        }`}
        role="switch"
        aria-checked={Boolean(value)}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
            value ? 'translate-x-4' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

/** Number input as text (avoids controlled-number decimal jank). Re-inits on remount (parent rev key). */
function NumberField({
  label,
  value,
  onChange,
  integer,
  min,
  max,
  hint,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  integer?: boolean;
  min?: number;
  max?: number;
  hint?: string;
}) {
  const [text, setText] = useState(() => (value == null ? '' : String(value)));
  const num = text.trim() === '' ? null : Number(text);
  const invalid = text.trim() !== '' && !Number.isFinite(num as number);
  const outOfRange =
    num != null &&
    Number.isFinite(num) &&
    ((min != null && (num as number) < min) || (max != null && (num as number) > max));

  const handle = (t: string) => {
    setText(t);
    if (t.trim() === '') {
      onChange(null);
      return;
    }
    const n = Number(t);
    if (Number.isFinite(n)) onChange(integer ? Math.trunc(n) : n);
  };

  return (
    <Field label={label} hint={hint}>
      <input
        type="text"
        inputMode="decimal"
        value={text}
        onChange={(e) => handle(e.target.value)}
        className={`${inputCls} ${invalid || outOfRange ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-200' : ''}`}
      />
      {invalid && <p className="mt-0.5 text-[10px] text-rose-600">숫자를 입력하세요</p>}
      {outOfRange && <p className="mt-0.5 text-[10px] text-amber-600">권장 범위를 벗어났습니다 (저장 시 거부될 수 있음)</p>}
    </Field>
  );
}

/** Multi-line string-list editor (one item per line). Re-inits on remount. */
function StringListField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string[] | null;
  onChange: (v: string[] | null) => void;
  hint?: string;
}) {
  const [text, setText] = useState(() => (value ?? []).join('\n'));
  const count = text.split('\n').map((s) => s.trim()).filter(Boolean).length;

  const handle = (t: string) => {
    setText(t);
    const arr = t.split('\n').map((s) => s.trim()).filter(Boolean);
    onChange(arr.length > 0 ? arr : null);
  };

  return (
    <Field label={label} hint={hint ? `${hint} · ${count}개` : `${count}개`}>
      <textarea rows={Math.min(8, Math.max(2, count + 1))} value={text} onChange={(e) => handle(e.target.value)} className={textareaCls} />
    </Field>
  );
}

/** Validated JSON-object textarea. Empty text → null. Reports validity to parent. */
function JsonField({
  label,
  value,
  onChange,
  onValidity,
  hint,
}: {
  label: string;
  value: Record<string, unknown> | null;
  onChange: (v: Record<string, unknown> | null) => void;
  onValidity: (valid: boolean) => void;
  hint?: string;
}) {
  const [text, setText] = useState(() => (value == null ? '' : JSON.stringify(value, null, 2)));
  const [err, setErr] = useState<string | null>(null);

  const handle = (t: string) => {
    setText(t);
    const trimmed = t.trim();
    if (trimmed === '') {
      setErr(null);
      onValidity(true);
      onChange(null);
      return;
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        setErr('JSON object 여야 합니다');
        onValidity(false);
        return;
      }
      setErr(null);
      onValidity(true);
      onChange(parsed as Record<string, unknown>);
    } catch {
      setErr('유효한 JSON이 아닙니다');
      onValidity(false);
    }
  };

  return (
    <Field label={label} hint={hint}>
      <textarea
        rows={Math.min(14, Math.max(3, text.split('\n').length))}
        value={text}
        spellCheck={false}
        onChange={(e) => handle(e.target.value)}
        className={`${textareaCls} font-mono text-xs ${err ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-200' : ''}`}
      />
      {err && <p className="mt-0.5 text-[10px] text-rose-600">{err}</p>}
    </Field>
  );
}

function NamesOtherLocales({
  value,
  onChange,
}: {
  value: Record<string, unknown> | null;
  onChange: (v: Record<string, unknown> | null) => void;
}) {
  const locales: Array<[string, string]> = [
    ['ja', '日本語'],
    ['zh', '简体中文'],
    ['zh-TW', '繁體中文'],
    ['es', 'Español'],
  ];
  const get = (k: string) => (typeof value?.[k] === 'string' ? (value[k] as string) : '');
  const setOne = (k: string, v: string) => {
    const next: Record<string, unknown> = { ...(value || {}) };
    if (v.trim() === '') delete next[k];
    else next[k] = v;
    onChange(Object.keys(next).length > 0 ? next : null);
  };
  return (
    <Field label="names_other_locales" hint="비우면 해당 로케일 제외 · 전부 비면 null">
      <div className="grid grid-cols-2 gap-2">
        {locales.map(([code, label]) => (
          <div key={code}>
            <span className="block text-[10px] text-slate-400 mb-0.5">
              {label} <span className="font-mono">({code})</span>
            </span>
            <input type="text" value={get(code)} onChange={(e) => setOne(code, e.target.value)} className={inputCls} />
          </div>
        ))}
      </div>
    </Field>
  );
}
