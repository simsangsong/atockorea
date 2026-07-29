'use client';

/**
 * W1.2 — the guest D-1 pre-selection editor (`/tour-mode/plan/[bookingId]`,
 * master plan §G).
 *
 * Three tabs on top of one shared stop editor:
 *   ① recommended courses (course_templates, seeded from live tours — P-D14)
 *   ② pick your own (curated match_pois picker + Google Places fallback with
 *      ~120m poi_key snapping)
 *   ③ leave it to the guide (bookings.itinerary.guide_curated — §G tab ③)
 * plus the A10 needs checklist (P-D11 → day_plans.needs) and live W1.3
 * feasibility warnings (P-D9 — badges only, never blocks).
 *
 * Auth = the room join flow (invite token `?rt=` consumed once, scrubbed,
 * then the signed x-tour-room-auth session). Editing is lead-guest-only
 * (P-D13) — everyone else gets a read-only view. Drafts auto-save (A2).
 * All times are KST (A11).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
// Reorder pair + glyphs the icons.ts barrel does not carry stay direct
// (IconMoveUp has no barrel entry; IconTime/IconSubmit/IconPerson are distinct glyphs
// from the barrel's Clock/ArrowUp/User).
import { IconMoveDown, IconMoveUp, IconTime, IconSubmit, IconPerson } from '@/components/tour-mode/icons';
import {
  IconArrived,
  IconAsk,
  IconClose,
  IconConcierge,
  IconDining,
  IconJourney,
  IconPlus,
  IconSuccess,
  IconTabMap,
  IconTrash,
  IconMore,
  IconWarn,
  TR_ICON,
  TR_STROKE,
} from '@/components/tour-mode/icons';
import { koreanAllergyCardLines } from '@/lib/tour-room/allergyCard';
import { formatMinutes, haversineKm, totalDriveMinutes, type LatLng } from '@/lib/itinerary-builder/distance';
import { normalizeRoomLocale, type RoomLocale } from '@/lib/tour-room/snapshot';
import { useTourRoomSession } from '@/hooks/useTourRoomSession';
import { useResolvedTheme, useShellSurface } from '@/hooks/useTourRoomSettings';
import { useBackTrap } from '@/hooks/useBackTrap';
import Sheet from '@/components/tour-mode/Sheet';
import TimeWheel from '@/components/tour-mode/cockpit/TimeWheel';
import PlanTourItinerary from '@/components/tour-mode/plan/PlanTourItinerary';
import {
  isCourseOptionItinerary,
  toCourseOptions,
  type CourseOption,
} from '@/lib/tour-room/courseOptions';
import PlanStopCards from '@/components/tour-mode/plan/PlanStopCards';
import { PoiThumb } from '@/components/tour-mode/plan/PoiThumb';
import { dayPhase } from '@/lib/tour-room/dayPhase';
import { COPY, PLAN_STATUS_COPY, ROOM_LOCALE_VALUES } from '@/components/tour-mode/plan/planCopy';
import type { ItineraryStop } from '@/components/product-tour-static/_shared/tourProductDetailSectionTypes';
import { MAX_PLAN_STOPS, tourStopToEditorStop } from '@/lib/tour-room/planTourStops';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EditorStop {
  id: string;
  source: 'poi' | 'google' | 'free';
  poi_key?: string | null;
  place_id?: string | null;
  title: string;
  stop_type: string;
  arrival_planned?: string | null;
  duration_min: number | null;
  lat?: number | null;
  lng?: number | null;
  memo_guest?: string;
}

interface NeedsState {
  adults: number;
  children: number;
  child_ages: string;
  stroller: boolean;
  wheelchair: boolean;
  luggage: boolean;
  dietary: string[];
  allergy_note: string;
  pace: 'relaxed' | 'standard' | 'packed';
  note: string;
}

interface FeasibilityWarning {
  code: 'overrun' | 'closed' | 'out_of_region' | 'cross_island';
  stop_id?: string;
  title?: string;
  detail: Record<string, string | number>;
}

interface PlanResponse {
  source: string;
  schedule: Array<Record<string, unknown>>;
  day_plan: {
    status?: string;
    stops?: Array<Record<string, unknown>>;
    needs?: Record<string, unknown> | null;
    feasibility?: { warnings?: FeasibilityWarning[] } | null;
    version?: number;
    /** §11.D D4 — daily departure time "HH:MM" (KST), null until set. */
    departure_time?: string | null;
  } | null;
  viewer: { role: string; is_lead: boolean; can_edit: boolean };
  tour: {
    date: string | null;
    region: string | null;
    total_hours: number | null;
    guide_curated: boolean;
    /** Private (vehicle-charter) tour → editable planner; false (per-person bus /
     *  small-group) → fixed itinerary, view-only. */
    is_private: boolean;
  };
}

interface CourseTemplate {
  id: string;
  title_i18n: Record<string, string>;
  stops: Array<Record<string, unknown>>;
  total_hours: number | null;
  /** The tour this course was seeded from — its rich itineraryStops (photos +
   *  descriptions) power the course preview's tap-to-detail cards. */
  origin_tour_slug?: string | null;
}

interface PickerPoi {
  poi_key: string;
  name_en: string | null;
  name_ko: string | null;
  names_other_locales: Record<string, string> | null;
  category: string | null;
  default_image_url: string | null;
  /**
   * 🔴 P7.1 — the field this screen was throwing away.
   *
   * `/api/itinerary-builder/pois` has always selected `images`; the planner
   * simply never declared it, so 63 POIs with a photo rendered as blank
   * squares. Read through `poiImageCandidates`, never directly — see
   * `lib/tour-room/poiImage.ts` for why the first entry is not enough.
   */
  images: string[] | null;
  default_stay_minutes: number | null;
  lat: number | null;
  lng: number | null;
}

// ---------------------------------------------------------------------------
// Copy — room 5-locale convention (P-D10)
// ---------------------------------------------------------------------------



// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DURATION_OPTIONS = [30, 45, 60, 90, 120, 180, 240];
/** Google pick within this range of a curated POI snaps to its poi_key (§G tab ②). */
const POI_SNAP_KM = 0.12;

function detectLocale(): RoomLocale {
  // Server always 'en' (Node ≥21 exposes the SERVER's navigator.language —
  // trusting it breaks hydration for non-en devices); client detects for real.
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'en';
  // normalizeRoomLocale keeps zh-TW whole (a bare split folds it to 'zh').
  return normalizeRoomLocale(navigator.language || 'en', 'en');
}

function scrubTokenFromUrl(): void {
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has('rt')) {
      url.searchParams.delete('rt');
      window.history.replaceState(window.history.state, '', url.toString());
    }
  } catch {
    /* noop */
  }
}

function poiName(poi: PickerPoi, locale: RoomLocale): string {
  if (locale === 'ko' && poi.name_ko) return poi.name_ko;
  const other = poi.names_other_locales;
  if (other && typeof other === 'object') {
    const localized = other[locale];
    if (typeof localized === 'string' && localized.trim()) return localized;
  }
  return poi.name_en ?? poi.poi_key;
}

function stopTitleFrom(raw: Record<string, unknown>, locale: RoomLocale): string {
  const names = raw.name_i18n;
  if (names && typeof names === 'object') {
    const record = names as Record<string, string>;
    const localized = record[locale];
    if (typeof localized === 'string' && localized.trim()) return localized;
    if (typeof record.en === 'string' && record.en.trim()) return record.en;
    const first = Object.values(record).find((v) => typeof v === 'string' && v.trim());
    if (first) return first;
  }
  if (typeof raw.poi_key === 'string' && raw.poi_key) {
    return raw.poi_key
      .split(/[_\s]+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  return '';
}

function toEditorStops(rawStops: Array<Record<string, unknown>> | undefined, locale: RoomLocale): EditorStop[] {
  if (!Array.isArray(rawStops)) return [];
  return rawStops
    .filter((s) => s && typeof s === 'object')
    .map((s, index) => ({
      id: typeof s.id === 'string' ? s.id : `stop-${index + 1}-${Math.random().toString(36).slice(2, 8)}`,
      source: (s.source === 'poi' || s.source === 'google' ? s.source : s.poi_key ? 'poi' : 'free') as EditorStop['source'],
      poi_key: typeof s.poi_key === 'string' ? s.poi_key : null,
      place_id: typeof s.place_id === 'string' ? s.place_id : null,
      title: stopTitleFrom(s, locale),
      stop_type: typeof s.stop_type === 'string' ? s.stop_type : 'sight',
      arrival_planned: typeof s.arrival_planned === 'string' ? s.arrival_planned.slice(0, 5) : null,
      duration_min: typeof s.duration_min === 'number' ? s.duration_min : null,
      lat: typeof s.lat === 'number' ? s.lat : null,
      lng: typeof s.lng === 'number' ? s.lng : null,
      memo_guest: typeof s.memo_guest === 'string' ? s.memo_guest : undefined,
    }))
    .filter((s) => s.title);
}

function toNeedsState(raw: Record<string, unknown> | null | undefined): NeedsState {
  const src = raw && typeof raw === 'object' ? raw : {};
  return {
    adults: typeof src.adults === 'number' ? src.adults : 2,
    children: typeof src.children === 'number' ? src.children : 0,
    child_ages: Array.isArray(src.child_ages) ? (src.child_ages as number[]).join(', ') : '',
    stroller: src.stroller === true,
    wheelchair: src.wheelchair === true,
    luggage: src.luggage === true,
    dietary: Array.isArray(src.dietary) ? (src.dietary as string[]) : [],
    allergy_note: typeof src.allergy_note === 'string' ? src.allergy_note : '',
    pace: src.pace === 'relaxed' || src.pace === 'packed' ? src.pace : 'standard',
    note: typeof src.note === 'string' ? src.note : '',
  };
}

function needsPayload(needs: NeedsState): Record<string, unknown> {
  return {
    adults: needs.adults,
    children: needs.children,
    child_ages: needs.child_ages
      .split(/[,\s]+/)
      .map((s) => Number.parseInt(s, 10))
      .filter((n) => Number.isFinite(n) && n >= 0 && n <= 17),
    stroller: needs.stroller,
    wheelchair: needs.wheelchair,
    luggage: needs.luggage,
    dietary: needs.dietary,
    ...(needs.allergy_note.trim() ? { allergy_note: needs.allergy_note.trim() } : {}),
    pace: needs.pace,
    ...(needs.note.trim() ? { note: needs.note.trim() } : {}),
  };
}

function stopsPayload(stops: EditorStop[]): Array<Record<string, unknown>> {
  return stops.map((s) => ({
    id: s.id,
    title: s.title,
    poi_key: s.poi_key ?? undefined,
    place_id: s.place_id ?? undefined,
    stop_type: s.stop_type,
    arrival_planned: s.arrival_planned ?? undefined,
    duration_min: s.duration_min ?? undefined,
    lat: s.lat ?? undefined,
    lng: s.lng ?? undefined,
    memo_guest: s.memo_guest || undefined,
  }));
}


// ---------------------------------------------------------------------------
// Google Places fallback search (tab ② — lazy: mounts only when expanded)
// ---------------------------------------------------------------------------

interface GooglePlaceHit {
  place_id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

function GooglePlaceSearch({
  region,
  placeholder,
  loadingLabel,
  errorLabel,
  onPick,
}: {
  region: string | null;
  placeholder: string;
  loadingLabel: string;
  errorLabel: string;
  onPick: (pick: { place_id: string; name: string; lat: number; lng: number }) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GooglePlaceHit[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const onPickRef = useRef(onPick);
  useEffect(() => {
    onPickRef.current = onPick;
  });

  // Debounced server-side Places (New) Text Search via /api/places/search — no
  // client-side Google Maps JS, so the browser referrer restriction on the
  // public key can't break it (and the legacy Autocomplete widget is retired).
  // setState routed through nested fns (react-hooks/set-state-in-effect guard).
  useEffect(() => {
    const q = query.trim();
    let cancelled = false;
    const apply = (r: GooglePlaceHit[], s: 'idle' | 'loading' | 'error') => {
      if (cancelled) return;
      setResults(r);
      setState(s);
    };
    if (q.length < 2) {
      apply([], 'idle');
      return;
    }
    const begin = () => {
      if (!cancelled) setState('loading');
    };
    begin();
    const timer = setTimeout(() => {
      fetch(`/api/places/search?q=${encodeURIComponent(q)}${region ? `&region=${encodeURIComponent(region)}` : ''}`)
        .then(async (res) => {
          const body = (await res.json().catch(() => null)) as { results?: GooglePlaceHit[] } | null;
          apply(body?.results ?? [], res.ok ? 'idle' : 'error');
        })
        .catch(() => apply([], 'error'));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, region]);

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        type="text"
        placeholder={placeholder}
        className="tr-card-text w-full rounded-[var(--tr-radius-input)] border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-3 py-2 text-[var(--tr-ink)] placeholder:text-[var(--tr-ink-3)] focus:border-[var(--tr-accent)] focus:outline-none"
      />
      {state === 'loading' && <p className="tr-meta mt-1 px-1 text-[var(--tr-ink-3)]">{loadingLabel}</p>}
      {state === 'error' && (
        <p className="tr-label mt-1 rounded-xl border border-[var(--tr-danger-soft)] bg-[var(--tr-surface)] px-3 py-2 text-[var(--tr-danger)]">
          {errorLabel}
        </p>
      )}
      {results.length > 0 && (
        <ul className="mt-1 overflow-hidden rounded-xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)]">
          {results.map((r) => (
            <li key={r.place_id} className="border-b border-[var(--tr-hairline)] last:border-b-0">
              <button
                type="button"
                onClick={() => {
                  onPickRef.current({ place_id: r.place_id, name: r.name, lat: r.lat, lng: r.lng });
                  setQuery('');
                  setResults([]);
                }}
                className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left active:bg-[var(--tr-surface-2)]"
              >
                <span className="tr-card-text font-medium text-[var(--tr-ink)]">{r.name}</span>
                {r.address ? <span className="tr-meta text-[var(--tr-ink-3)]">{r.address}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/** The time wheel's neutral resting row — what [이 시각으로] commits when the
 *  guest never scrolled. Shared by the wheel and its confirm button so the
 *  button can never promise a different time than the one on screen. */
const WHEEL_REST = '09:00';

type EditorTab = 'courses' | 'pick' | 'delegate';
type LoadState = 'idle' | 'loading' | 'ready' | 'error';
type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error' | 'rate_limited';
type SaveExtra = { submit?: boolean };
interface DraftSnapshot {
  stops: EditorStop[];
  needs: NeedsState;
  stopsChanged?: boolean;
  /**
   * D4 — present only on a departure-time edit, so a stops/needs save never
   * force-writes departure_time (the server treats an absent field as no-op).
   */
  departureTime?: string | null;
}

interface PlanSaveResponse {
  day_plan?: PlanResponse['day_plan'];
  feasibility?: { warnings?: FeasibilityWarning[] };
  error?: string;
}

/**
 * Copy for the fixed-itinerary (non-private) view. Per-person bus / small-group
 * tours run a set route, so the planner is view-only for them — self-contained
 * so it doesn't bloat the main PlanCopy blocks (사용자 확정 2026-07-20).
 */
const FIXED_ITIN_COPY: Record<RoomLocale, { eyebrow: string; note: string }> = {
  en: {
    eyebrow: 'Set itinerary',
    note: 'This tour runs a set route planned by our team — no need to build one. Here’s what your day includes:',
  },
  ko: {
    eyebrow: '정해진 일정',
    note: '이 투어는 저희 팀이 짜둔 정해진 코스로 진행돼요. 따로 일정을 만들 필요 없이, 오늘 일정은 아래와 같아요:',
  },
  ja: {
    eyebrow: '固定コース',
    note: 'このツアーはチームが計画した固定ルートで進みます。プランを作る必要はありません。当日の行程はこちらです:',
  },
  zh: {
    eyebrow: '固定行程',
    note: '本行程按我们团队规划好的固定路线进行，无需自行安排。今天的行程如下:',
  },
  'zh-TW': {
    eyebrow: '固定行程',
    note: '本行程依我們團隊規劃好的固定路線進行，不必自行安排。今天的行程如下：',
  },
  es: {
    eyebrow: 'Itinerario fijo',
    note: 'Este tour sigue una ruta fija planificada por nuestro equipo — no necesitas crear una. Esto es lo que incluye tu día:',
  },
  fr: {
    eyebrow: 'Itinéraire fixe',
    note: 'Ce tour suit un parcours fixe préparé par notre équipe — rien à organiser. Voici ce que comprend votre journée:',
  },
  de: {
    eyebrow: 'Feste Route',
    note: 'Diese Tour folgt einer festen, von unserem Team geplanten Route — Sie müssen nichts planen. Das erwartet Sie heute:',
  },
  ru: {
    eyebrow: 'Готовый маршрут',
    note: 'Этот тур идет по готовому маршруту, составленному нашей командой — планировать ничего не нужно. Вот что входит в ваш день:',
  },
  it: {
    eyebrow: 'Itinerario fisso',
    note: 'Questo tour segue un percorso fisso preparato dal nostro team — non devi organizzare nulla. Ecco cosa include la tua giornata:',
  },
};

export default function PlanEditorClient({ bookingId }: { bookingId: string }) {
  const { state, join, roomSession } = useTourRoomSession(bookingId);
  /**
   * 🔴 The planner is the one tour-mode surface that opens with NO shell above
   * it (the invite email links straight here), so nothing was ever applying the
   * guest's stored theme: `.dark .tr-plan-root` existed in the CSS but could
   * never match, and a dark-mode guest got a full-white page in the hand at
   * 6am. The class goes on the root itself — the CSS now carries the self-form.
   *
   * Skin (`data-tr-skin`) is deliberately NOT threaded through: a skin block
   * outranks `.tr-plan-root` and would replace half this screen's palette while
   * leaving the planner-only tokens (--tr-accent-hi) behind, i.e. a gradient
   * whose two stops come from different families. The planner keeps its own
   * palette on purpose; that is what `.tr-plan-root` is for.
   */
  const { theme } = useResolvedTheme();
  const themeClass = theme === 'dark' ? 'dark' : '';

  /**
   * 🔴 P7.1b — the shell surface contract (C1), which this screen never signed.
   *
   * Measured 2026-07-30, same localStorage, two screens side by side:
   *
   *     room     textScale:5  →  --tr-font-scale 1.35    OK
   *     planner  textScale:5  →  --tr-font-scale 1       X
   *
   * The planner opens with no shell above it, so there was nothing to plant the
   * variable — and every `tr-*` size is `calc(… * var(--tr-font-scale, 1))`, so
   * the fallback is 1 and the failure is silent. A guest who enlarged their text
   * lost the setting on the screen with the MOST small type in the app, and the
   * settings screen went on promising a change that never arrived.
   *
   * This is the same defect as the cockpit's (사용자 리포트 2026-07-28), one
   * shell later, exactly as `useShellSurface`'s own comment predicted: a
   * hand-copied contract drifts on the NEXT shell. So it is consumed here
   * rather than re-typed, and the C1 guard now renders this screen too.
   *
   * ⚠ Only the STYLE half is spread. `data-tr-skin` stays off until P7.8, where
   * §N-9 option B decides which token families a skin may touch here — stamping
   * it now would ship precisely the split-family gradient the comment above
   * warns about, and would sit on main until that ticket lands. The
   * accessibility half has no such dependency and is the reason this ticket is
   * ordered before P7.3 (typography), which is measured in these units.
   */
  const { surfaceProps } = useShellSurface({ theme });
  const surfaceStyle = surfaceProps.style;
  /**
   * 🔴 P7.8 (§N-9) — the skin half of the contract, which P7.1b deliberately
   * held back until the palette consequences were designed and measured.
   *
   * `.tr-plan-root[data-tr-skin]` in the stylesheet decides what a skin is
   * allowed to touch here: the neutral family travels with the skin, the
   * planner keeps its deep-pine accent identity. See that block for why
   * "background only" could not be implemented literally.
   */
  const surfaceSkin = surfaceProps['data-tr-skin'];
  const attempted = useRef(false);
  const [locale, setLocale] = useState<RoomLocale>(() => detectLocale());
  const copy = COPY[locale];
  const ui = PLAN_STATUS_COPY[locale];

  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [templates, setTemplates] = useState<CourseTemplate[]>([]);
  const [pois, setPois] = useState<PickerPoi[]>([]);
  const [templatesState, setTemplatesState] = useState<LoadState>('idle');
  const [poisState, setPoisState] = useState<LoadState>('idle');
  const [loadError, setLoadError] = useState(false);

  const [tab, setTab] = useState<EditorTab>('courses');
  const [stops, setStops] = useState<EditorStop[]>([]);
  const [needs, setNeeds] = useState<NeedsState>(() => toNeedsState(null));
  // D4 — the lead guest's daily departure time (HH:MM KST), null until set.
  const [departureTime, setDepartureTime] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<FeasibilityWarning[]>([]);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [outcome, setOutcome] = useState<'submitted' | 'delegated' | null>(null);
  const [poiQuery, setPoiQuery] = useState('');
  const [googleOpen, setGoogleOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<CourseTemplate | null>(null);
  const [replaceArmed, setReplaceArmed] = useState(false);
  // The previewed course's own rich itinerary (photos + descriptions), pulled
  // from its origin_tour_slug so the preview shows the same tap-to-detail stop
  // cards as the product page instead of bland text rows. Empty → text fallback.
  const [previewRichStops, setPreviewRichStops] = useState<ItineraryStop[]>([]);
  // §G tab ① — the BOOKED tour's own itinerary (rich stop cards + shared drawer).
  const [tourStops, setTourStops] = useState<ItineraryStop[]>([]);
  const [tourTitle, setTourTitle] = useState<string | null>(null);
  const [submitBusy, setSubmitBusy] = useState(false);
  // R2 — this page opens standalone from the invite email, so a hardware back
  // press used to close the installed PWA outright. One press now closes the
  // open preview/picker, then steps 담기→추천, and only then leaves.
  useBackTrap(() => {
    if (previewTemplate) {
      setPreviewTemplate(null);
      return 'stayed';
    }
    if (googleOpen) {
      setGoogleOpen(false);
      return 'stayed';
    }
    if (tab !== 'courses') {
      setTab('courses');
      return 'stayed';
    }
    return 'noop';
  });
  const hydrated = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDraft = useRef<DraftSnapshot>({ stops: [], needs });
  const submittingRef = useRef(false);

  useEffect(() => {
    latestDraft.current = { stops, needs, stopsChanged: latestDraft.current.stopsChanged };
  }, [stops, needs]);

  // ── boot: join with ?rt=, scrub, adopt booking locale ─────────────────────
  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;
    const url = new URL(window.location.href);
    const token = url.searchParams.get('rt');
    void join({ token: token || undefined }).then((result) => {
      if (!result) return;
      scrubTokenFromUrl();
      const resolved = result.participant?.locale;
      if (resolved && (ROOM_LOCALE_VALUES as readonly string[]).includes(resolved)) {
        setLocale(resolved as RoomLocale);
      }
    });
  }, [join]);

  const authedFetch = useCallback(
    (path: string, init?: RequestInit) =>
      fetch(`/api/tour-rooms/${encodeURIComponent(bookingId)}${path}`, {
        ...init,
        headers: {
          ...(init?.headers ?? {}),
          ...(roomSession ? { 'x-tour-room-auth': roomSession } : {}),
          ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        },
      }),
    [bookingId, roomSession],
  );

  // ── load plan + templates + pois once joined ───────────────────────────────
  useEffect(() => {
    if (state.status !== 'joined' || !roomSession || hydrated.current) return;
    hydrated.current = true;
    void (async () => {
      try {
        setTemplatesState('loading');
        setPoisState('loading');
        const [planRes, templatesRes] = await Promise.all([
          authedFetch('/plan'),
          authedFetch('/plan/templates'),
        ]);
        if (!planRes.ok) {
          setLoadError(true);
          return;
        }
        const planBody = (await planRes.json()) as PlanResponse;
        const loadedStops = toEditorStops(planBody.day_plan?.stops as Array<Record<string, unknown>>, locale);
        const loadedNeeds = toNeedsState(planBody.day_plan?.needs);
        const loadedDeparture =
          typeof planBody.day_plan?.departure_time === 'string' ? planBody.day_plan.departure_time : null;
        latestDraft.current = { stops: loadedStops, needs: loadedNeeds, departureTime: loadedDeparture };
        setPlan(planBody);
        setStops(loadedStops);
        setNeeds(loadedNeeds);
        setDepartureTime(loadedDeparture);
        setWarnings(planBody.day_plan?.feasibility?.warnings ?? []);
        if (planBody.day_plan?.status === 'guest_submitted') {
          setOutcome('submitted');
        } else if (planBody.tour.guide_curated) {
          setOutcome('delegated');
        } else {
          setOutcome(null);
        }
        if ((planBody.day_plan?.stops?.length ?? 0) > 0) setTab('pick');

        if (templatesRes.ok) {
          const body = (await templatesRes.json()) as { region: string | null; templates: CourseTemplate[] };
          setTemplates(body.templates ?? []);
          setTemplatesState('ready');
          if (body.region) {
            try {
              const poisRes = await fetch(`/api/itinerary-builder/pois?region=${body.region}`);
              if (!poisRes.ok) throw new Error(`pois_${poisRes.status}`);
              const poisBody = (await poisRes.json()) as { pois?: PickerPoi[] };
              setPois(poisBody.pois ?? []);
              setPoisState('ready');
            } catch {
              setPoisState('error');
            }
          } else {
            setPoisState('ready');
          }
        } else {
          setTemplatesState('error');
          setPoisState('ready');
        }

        // §G tab ① — the booked tour's own itinerary (best-effort: an absent
        // detail page or a load failure just leaves the generic templates).
        try {
          const itinRes = await authedFetch(`/tour-itinerary?locale=${locale}`);
          if (itinRes.ok) {
            const itinBody = (await itinRes.json()) as { stops?: ItineraryStop[]; tourTitle?: string | null };
            setTourStops(Array.isArray(itinBody.stops) ? itinBody.stops : []);
            setTourTitle(itinBody.tourTitle ?? null);
          }
        } catch {
          /* templates remain the fallback */
        }
      } catch {
        setLoadError(true);
      }
    })();
  }, [state.status, roomSession, authedFetch, locale]);

  const planStatus = plan?.day_plan?.status ?? null;
  const isSubmitted = outcome === 'submitted' || planStatus === 'guest_submitted';
  const canEdit = Boolean(plan?.viewer.can_edit) && !isSubmitted;
  const isConfirmed = planStatus !== null && planStatus !== 'guest_draft' && planStatus !== 'guest_submitted';

  // ── save (A2 auto-save, debounced) ────────────────────────────────────────
  const applySaveResponse = useCallback((data: PlanSaveResponse) => {
    if (data.day_plan) {
      setPlan((prev) => (prev ? { ...prev, day_plan: data.day_plan ?? prev.day_plan } : prev));
    }
    const nextWarnings = data.feasibility?.warnings ?? data.day_plan?.feasibility?.warnings;
    if (nextWarnings) setWarnings(nextWarnings);
    if (data.day_plan?.status === 'guest_submitted') setOutcome('submitted');
  }, []);

  /**
   * 🔴 A1.5 — the plan was locked underneath us (409 `plan_locked`): the guide
   * confirmed it, or another device submitted it, while this editor was open.
   *
   * Re-reading the plan is the honest response. Without it the guest just sees
   * "저장 실패" at the bottom of a screen that still looks editable, keeps
   * editing, and every keystroke is discarded — the editor would be lying about
   * being an editor. Pulling the server truth flips `isConfirmed`/`isSubmitted`,
   * which swaps the whole surface to the read-only view and shows
   * `confirmedNote` ("ask in the chat"), the copy that already exists in all 5
   * locales for exactly this situation.
   *
   * Costs one GET, and only on a real conflict.
   */
  const resyncLockedPlan = useCallback(async () => {
    try {
      const res = await authedFetch('/plan');
      if (!res.ok) return false;
      const body = (await res.json()) as PlanResponse;
      const serverStops = toEditorStops(body.day_plan?.stops as Array<Record<string, unknown>>, locale);
      const serverNeeds = toNeedsState(body.day_plan?.needs);
      const serverDeparture =
        typeof body.day_plan?.departure_time === 'string' ? body.day_plan.departure_time : null;
      latestDraft.current = { stops: serverStops, needs: serverNeeds, departureTime: serverDeparture };
      setPlan(body);
      setStops(serverStops);
      setNeeds(serverNeeds);
      setDepartureTime(serverDeparture);
      setWarnings(body.day_plan?.feasibility?.warnings ?? []);
      if (body.day_plan?.status === 'guest_submitted') setOutcome('submitted');
      return true;
    } catch {
      return false;
    }
  }, [authedFetch, locale]);

  const save = useCallback(
    async (draft: DraftSnapshot, extra?: SaveExtra) => {
      if (!plan?.viewer.can_edit) return null;
      setSaveState('saving');
      try {
        const body: Record<string, unknown> = {
          needs: needsPayload(draft.needs),
          stops: stopsPayload(draft.stops),
          ...(draft.stopsChanged ? { stops_changed: true } : {}),
          ...(draft.departureTime !== undefined ? { departure_time: draft.departureTime } : {}),
          ...extra,
        };
        const res = await authedFetch('/plan', { method: 'PUT', body: JSON.stringify(body) });
        const data = (await res.json().catch(() => ({}))) as PlanSaveResponse;
        if (!res.ok) {
          /**
           * 🔴 P1 — 409(가이드가 확정)와 403(이 기기는 대표자가 아님)은 **영구
           * 실패**다. 예전에는 403이 일반 실패로 떨어져 "다음 수정 때 다시
           * 시도해요"를 보여줬는데, 아무리 고쳐도 저장되지 않으므로 그건 거짓말이다
           * (사용자 리포트 2026-07-27의 `Couldn't save`). 서버 진실을 다시 읽어
           * 화면을 읽기전용으로 바꾼다.
           */
          if (res.status === 409 || res.status === 403) {
            setSaveState('idle');
            const synced = await resyncLockedPlan();
            if (!synced) setSaveState('error');
            return null;
          }
          setSaveState(res.status === 429 ? 'rate_limited' : 'error');
          // 어떤 실패였는지 남긴다 — 한 문장짜리 안내만으로는 다음에 또 못 고친다.
          console.warn('[plan] save failed', res.status, data);
          return null;
        }
        applySaveResponse(data);
        if (draft.stopsChanged) {
          latestDraft.current = { ...latestDraft.current, stopsChanged: false };
        }
        setSaveState('saved');
        return data;
      } catch {
        setSaveState('error');
        return null;
      }
    },
    [applySaveResponse, authedFetch, plan?.viewer.can_edit, resyncLockedPlan],
  );

  const scheduleAutosave = useCallback((draft: DraftSnapshot) => {
    latestDraft.current = draft;
    setSaveState('dirty');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      // 🔴 Clearing the handle is what makes "is a save pending?" answerable.
      // While it stayed set after firing, `flushPending` believed a draft was
      // waiting forever after the first edit, and re-PUT the already-saved plan
      // on every tab switch for the rest of the session.
      saveTimer.current = null;
      void save(draft);
    }, 2500);
  }, [save]);

  // Best-effort flush of a pending debounced draft before the tab is
  // backgrounded, closed, or the planner is left (SPA nav) — otherwise a fast
  // "edit → leave" silently drops up to 2.5s of changes. keepalive lets the
  // request outlive the page. No-op when nothing is pending.
  const flushPending = useCallback(() => {
    if (!saveTimer.current) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = null;
    if (!plan?.viewer.can_edit || !roomSession) return;
    const draft = latestDraft.current;
    try {
      void fetch(`/api/tour-rooms/${encodeURIComponent(bookingId)}/plan`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-tour-room-auth': roomSession },
        body: JSON.stringify({
          needs: needsPayload(draft.needs),
          stops: stopsPayload(draft.stops),
          ...(draft.stopsChanged ? { stops_changed: true } : {}),
          ...(draft.departureTime !== undefined ? { departure_time: draft.departureTime } : {}),
        }),
        keepalive: true,
      });
    } catch {
      /* best effort — the next explicit save still catches it */
    }
  }, [bookingId, roomSession, plan?.viewer.can_edit]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushPending();
    };
    window.addEventListener('pagehide', flushPending);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flushPending);
      document.removeEventListener('visibilitychange', onVisibility);
      flushPending();
    };
  }, [flushPending]);

  // ── mutations ─────────────────────────────────────────────────────────────
  const mutateStops = useCallback(
    (updater: (prev: EditorStop[]) => EditorStop[]) => {
      if (outcome === 'delegated') setOutcome(null);
      setStops((prev) => {
        const next = updater(prev);
        const draft = { stops: next, needs: latestDraft.current.needs, stopsChanged: true };
        latestDraft.current = draft;
        scheduleAutosave(draft);
        return next;
      });
    },
    [outcome, scheduleAutosave],
  );

  const mutateNeeds = useCallback(
    (patch: Partial<NeedsState>) => {
      setNeeds((prev) => {
        const next = { ...prev, ...patch };
        const draft = {
          stops: latestDraft.current.stops,
          needs: next,
          stopsChanged: latestDraft.current.stopsChanged,
        };
        latestDraft.current = draft;
        scheduleAutosave(draft);
        return next;
      });
    },
    [scheduleAutosave],
  );

  // D4 — a departure-time edit rides the same debounced autosave/PUT path.
  // Only this draft carries `departureTime`, so stops/needs saves never touch it.
  const mutateDeparture = useCallback(
    (value: string | null) => {
      setDepartureTime(value);
      const draft: DraftSnapshot = {
        stops: latestDraft.current.stops,
        needs: latestDraft.current.needs,
        stopsChanged: latestDraft.current.stopsChanged,
        departureTime: value,
      };
      latestDraft.current = draft;
      scheduleAutosave(draft);
    },
    [scheduleAutosave],
  );

  useEffect(() => {
    if (state.status !== 'joined' || !roomSession) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await authedFetch('/my-seat');
        if (!res.ok) return;
        const body = (await res.json()) as { state?: string; seat_number?: string | null };
        if (cancelled) return;
        if (body.state === 'assigned' || body.state === 'pending' || body.state === 'none') {
          setSeat({ state: body.state, seat_number: body.seat_number ?? null });
        }
      } catch {
        /* 좌석 줄이 없다고 플래너가 못 쓰이면 안 된다 — 조용히 생략한다. */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state.status, roomSession, authedFetch]);

  const addPoiStop = (poi: PickerPoi) => {
    mutateStops((prev) => [
      ...prev,
      {
        id: `poi-${poi.poi_key}-${Date.now().toString(36)}`,
        source: 'poi',
        poi_key: poi.poi_key,
        title: poiName(poi, locale),
        stop_type: 'sight',
        duration_min: poi.default_stay_minutes ?? 60,
        lat: poi.lat,
        lng: poi.lng,
      },
    ]);
  };

  const addGooglePick = (pick: { place_id: string; name: string; lat: number; lng: number }) => {
    // §G tab ② — snap to a curated POI when the pick is ~the same place.
    const here: LatLng = { lat: pick.lat, lng: pick.lng };
    const snapped = pois.find(
      (p) =>
        typeof p.lat === 'number' &&
        typeof p.lng === 'number' &&
        haversineKm(here, { lat: p.lat, lng: p.lng }) <= POI_SNAP_KM,
    );
    if (snapped) {
      addPoiStop(snapped);
      return;
    }
    mutateStops((prev) => [
      ...prev,
      {
        id: `g-${Date.now().toString(36)}`,
        source: 'google',
        place_id: pick.place_id,
        title: pick.name.slice(0, 120),
        stop_type: 'sight',
        duration_min: 60,
        lat: pick.lat,
        lng: pick.lng,
      },
    ]);
  };

  // App-style confirm lives in the preview sheet footer (setReplaceArmed) — no
  // jarring browser confirm() dialog (master plan §5.3).
  const applyTemplate = (template: CourseTemplate) => {
    const nextStops = toEditorStops(template.stops, locale);
    const draft = { stops: nextStops, needs: latestDraft.current.needs, stopsChanged: true };
    if (outcome === 'delegated') setOutcome(null);
    setStops(nextStops);
    setWarnings([]);
    setTab('pick');
    scheduleAutosave(draft);
  };

  // §G tab ① — adopt the whole booked-tour itinerary as the wish-list plan.
  const applyTourItinerary = () => {
    const nextStops = tourStops
      .map((s, i) => tourStopToEditorStop(s, s._poi_meta?.poi_key ? poiByKey.get(s._poi_meta.poi_key) : undefined, i))
      .slice(0, MAX_PLAN_STOPS);
    const draft = { stops: nextStops, needs: latestDraft.current.needs, stopsChanged: true };
    if (outcome === 'delegated') setOutcome(null);
    setStops(nextStops);
    setWarnings([]);
    setTab('pick');
    scheduleAutosave(draft);
  };

  /**
   * P0 — 전세 상품은 "정류지 목록"이 아니라 "코스 택1"을 싣고 온다. 그걸 그대로
   * 일정으로 가져오면 코스 네 개가 관광지 네 곳으로 들어앉는다(사용자 리포트
   * 2026-07-27). 구조로 판별해 선택지면 코스 카드로 렌더한다.
   */
  const courseOptions = useMemo(
    () => (isCourseOptionItinerary(tourStops) ? toCourseOptions(tourStops) : null),
    [tourStops],
  );

  /** 코스 하나 → 그 코스의 실제 장소들이 정류지가 된다. */
  const applyCourseOption = (course: CourseOption) => {
    if (course.isCustom) {
      // 커스텀 코스는 정류지를 만들지 않는다 — 고르라고 만든 것이므로 피커를 연다.
      setTab('pick');
      return;
    }
    const nextStops = course.poiKeys
      .map((key) => poiByKey.get(key))
      .filter((poi): poi is NonNullable<typeof poi> => Boolean(poi))
      .slice(0, MAX_PLAN_STOPS)
      .map((poi, i) => ({
        id: `poi-${poi.poi_key}-${i}`,
        source: 'poi' as const,
        poi_key: poi.poi_key,
        title: poiName(poi, locale),
        stop_type: 'sight',
        duration_min: poi.default_stay_minutes ?? 60,
        lat: poi.lat,
        lng: poi.lng,
      }));
    if (nextStops.length === 0) return;
    const draft = { stops: nextStops, needs: latestDraft.current.needs, stopsChanged: true };
    if (outcome === 'delegated') setOutcome(null);
    setStops(nextStops);
    setWarnings([]);
    setTab('pick');
    scheduleAutosave(draft);
  };

  // …or add a single itinerary stop (deduped by poi_key, capped at MAX_PLAN_STOPS).
  const addTourStop = (stop: ItineraryStop) => {
    const poi = stop._poi_meta?.poi_key ? poiByKey.get(stop._poi_meta.poi_key) : undefined;
    mutateStops((prev) => {
      if (stop._poi_meta?.poi_key && prev.some((s) => s.poi_key === stop._poi_meta?.poi_key)) return prev;
      if (prev.length >= MAX_PLAN_STOPS) return prev;
      return [...prev, tourStopToEditorStop(stop, poi, prev.length)];
    });
  };

  const closePreview = () => {
    setPreviewTemplate(null);
    setReplaceArmed(false);
    setPreviewRichStops([]);
  };

  // Pull the previewed course's rich itinerary (its origin_tour_slug) so the
  // preview shows photo cards + tap→detail like the product page, not bland
  // text rows. Empty result → the text fallback below. setState routed through
  // a nested fn so the effect body has no direct setState (lint guard).
  useEffect(() => {
    const slug = previewTemplate?.origin_tour_slug?.trim();
    let cancelled = false;
    const apply = (rich: ItineraryStop[]) => {
      if (!cancelled) setPreviewRichStops(rich);
    };
    apply([]); // reset while the new course (if any) loads
    if (slug) {
      void (async () => {
        try {
          const res = await authedFetch(`/tour-itinerary?slug=${encodeURIComponent(slug)}&locale=${locale}`);
          if (res.ok) {
            const body = (await res.json()) as { stops?: ItineraryStop[] };
            apply(Array.isArray(body.stops) ? body.stops : []);
          }
        } catch {
          /* text fallback */
        }
      })();
    }
    return () => {
      cancelled = true;
    };
  }, [previewTemplate, authedFetch, locale]);

  const submitPlan = async () => {
    // save()는 can_edit을 확인했는데 submit/delegate는 안 했다 — 대표자가 아닌
    // 기기에서도 요청이 나가 403을 받았다.
    if (!plan?.viewer.can_edit) return;
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitBusy(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    try {
      const result = await save(latestDraft.current, { submit: true });
      if (result) setOutcome('submitted');
    } finally {
      submittingRef.current = false;
      setSubmitBusy(false);
    }
  };

  /**
   * P-D19 — 같은 예약의 다른 기기가 편집자로 잡혀 있을 때 여기서 넘겨받는다.
   * 동행자(개인 초대로 들어온 기기)는 서버가 403으로 막는다.
   */
  const [claimBusy, setClaimBusy] = useState(false);
  /** P2 — one stop expands at a time; the rest stay one line tall. */
  const [expandedStopId, setExpandedStopId] = useState<string | null>(null);
  /** P2 — the stop whose ⋯ sheet is open (reorder / remove). */
  const [actionStopId, setActionStopId] = useState<string | null>(null);
  /**
   * P3 — which time the wheel is editing: a stop id, or 'departure'.
   * `<input type="time">` renders in the DEVICE locale, which is why an
   * English planner showed "오후 9:01" on the owner's phone. It also draws OS
   * chrome in the middle of an app that has its own.
   */
  const [timeSheetFor, setTimeSheetFor] = useState<string | null>(null);
  /**
   * P4 — read-only seat. Guest self-selection is deliberately NOT here:
   * ops has never assigned a seat (0 rows live) and seats hang off a
   * vehicle assignment, so a picker would be an empty screen.
   */
  const [seat, setSeat] = useState<{ state: 'assigned' | 'pending' | 'none'; seat_number: string | null } | null>(
    null,
  );
  const claimLead = async () => {
    if (claimBusy) return;
    setClaimBusy(true);
    try {
      const res = await authedFetch('/plan/claim-lead', { method: 'POST' });
      if (res.ok) await resyncLockedPlan();
    } finally {
      setClaimBusy(false);
    }
  };

  const delegatePlan = async () => {
    if (!plan?.viewer.can_edit) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    setSaveState('saving');
    try {
      const res = await authedFetch('/plan', {
        method: 'PUT',
        body: JSON.stringify({ delegate: true, needs: needsPayload(latestDraft.current.needs) }),
      });
      const data = (await res.json().catch(() => ({}))) as PlanSaveResponse;
      if (res.ok) {
        applySaveResponse(data);
        setOutcome('delegated');
        setSaveState('saved');
      } else if (res.status === 409) {
        setSaveState('idle');
        const synced = await resyncLockedPlan();
        if (!synced) setSaveState('error');
      } else {
        setSaveState(res.status === 429 ? 'rate_limited' : 'error');
      }
    } catch {
      setSaveState('error');
    }
  };

  // ── derived ───────────────────────────────────────────────────────────────
  const totalEstimateMin = useMemo(() => {
    const stay = stops.reduce((sum, s) => sum + (s.duration_min ?? 60), 0);
    const points = stops
      .filter((s) => typeof s.lat === 'number' && typeof s.lng === 'number')
      .map((s) => ({ lat: s.lat as number, lng: s.lng as number }));
    return stay + totalDriveMinutes(points);
  }, [stops]);

  const filteredPois = useMemo(() => {
    const query = poiQuery.trim().toLowerCase();
    const inPlan = new Set(stops.map((s) => s.poi_key).filter(Boolean));
    const list = pois.map((p) => ({ poi: p, name: poiName(p, locale), added: inPlan.has(p.poi_key) }));
    if (!query) return list;
    return list.filter(
      ({ poi, name }) =>
        name.toLowerCase().includes(query) ||
        (poi.name_en ?? '').toLowerCase().includes(query) ||
        (poi.name_ko ?? '').includes(poiQuery.trim()),
    );
  }, [pois, poiQuery, stops, locale]);

  const poiByKey = useMemo(() => new Map(pois.map((poi) => [poi.poi_key, poi])), [pois]);

  /**
   * P7.8 (H-7 / N2) — the day's grain, reused rather than rebuilt.
   *
   * N2 already answers "when" with a tone on the home card, using nothing but
   * tokens the skin itself defines, and with no words in it — so it needs no
   * translation. Widening its scope to 「내 하루」 is a selector change in the
   * stylesheet plus this line; a second tone system would be a second thing to
   * keep contrast-correct.
   *
   * `day` deliberately has no rule: tint every hour and no hour means anything.
   */
  const planDayPhase = useMemo(() => dayPhase({ nowMs: Date.now() }), []);

  /**
   * P7.6 — up to three POIs per course option, for the card's photo strip.
   *
   * Keyed by course index rather than computed inline so the lookup does not
   * rebuild on every keystroke in the search field, and so a course whose POIs
   * have not loaded yet simply renders no strip instead of three swatches that
   * would flip to photos a moment later.
   */
  const courseHeroPois = useMemo(() => {
    const out = new Map<number, Array<{ key: string; poi: PickerPoi; name: string }>>();
    for (const course of courseOptions ?? []) {
      const keys = course.poiKeys.length > 0 ? course.poiKeys : course.candidatePoiKeys;
      /**
       * 🔴 Resolve FIRST, then take three — the same filter the preview line
       * uses. A course's `constituent_pois` can name POIs outside the region
       * list this screen loaded, and the first draft kept those: the card
       * rendered a tinted "U" and "M" taken from the first letter of a database
       * key, next to a preview line naming three entirely different places.
       * A swatch is meant to say "this place has no photo yet", not to show a
       * guest a letter from a primary key.
       */
      const resolved = keys
        .map((key) => ({ key, poi: poiByKey.get(key) }))
        .filter((entry): entry is { key: string; poi: PickerPoi } => Boolean(entry.poi))
        .slice(0, 3)
        .map((entry) => ({ ...entry, name: poiName(entry.poi, locale) }));
      if (resolved.length === 0) continue;
      out.set(course.index, resolved);
    }
    return out;
  }, [courseOptions, locale, poiByKey]);
  const previewStops = useMemo(
    () => (previewTemplate ? toEditorStops(previewTemplate.stops, locale) : []),
    [locale, previewTemplate],
  );
  const previewDriveMin = useMemo(() => {
    const points = previewStops
      .filter((s) => typeof s.lat === 'number' && typeof s.lng === 'number')
      .map((s) => ({ lat: s.lat as number, lng: s.lng as number }));
    return totalDriveMinutes(points);
  }, [previewStops]);
  const previewStayMin = useMemo(
    () => previewStops.reduce((sum, stop) => sum + (stop.duration_min ?? 60), 0),
    [previewStops],
  );

  // ── render ────────────────────────────────────────────────────────────────
  if (state.status === 'idle' || state.status === 'joining' || (state.status === 'joined' && !plan && !loadError)) {
    return (
      <div
        className={`tr-root mx-auto flex min-h-dvh w-full flex-col bg-[var(--tr-canvas)] ${themeClass}`}
        style={surfaceStyle}
        data-tr-skin={surfaceSkin}
        aria-busy="true"
      >
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-3 px-4 pt-8">
          <div className="tr-skeleton h-6 w-48 rounded-full" />
          <div className="tr-skeleton h-10 w-full rounded-xl" />
          <div className="tr-skeleton h-28 w-full rounded-[var(--tr-radius-card)]" />
          <div className="tr-skeleton h-28 w-full rounded-[var(--tr-radius-card)]" />
          {/* Client may legitimately detect a non-en device locale here. */}
          <span className="sr-only" suppressHydrationWarning>
            {copy.loading}
          </span>
        </div>
      </div>
    );
  }

  if (state.status === 'error' || loadError || !plan) {
    return (
      <div
        className={`tr-root flex min-h-dvh items-center justify-center bg-[var(--tr-canvas)] px-6 ${themeClass}`}
        style={surfaceStyle}
        data-tr-skin={surfaceSkin}
      >
        <div className="tr-card max-w-md px-5 py-6 text-center">
          <p className="tr-body text-[var(--tr-ink)]">{copy.joinError}</p>
        </div>
      </div>
    );
  }

  const roomHref = `/tour-mode/room/${encodeURIComponent(bookingId)}`;
  const tabItems: Array<[EditorTab, string, typeof IconJourney]> = [
    ['courses', copy.tabCourses, IconJourney],
    ['pick', copy.tabPick, IconArrived],
    ['delegate', copy.tabDelegate, IconConcierge],
  ];

  // Fixed-itinerary tours (per-person bus / small-group / coach): the route is
  // set, so the planner is VIEW-ONLY — show the tour's own itinerary and a note,
  // no tabs / editing / submit (사용자 확정 2026-07-20). Private (vehicle-charter)
  // tours fall through to the editable planner below.
  if (!plan.tour.is_private) {
    const fx = FIXED_ITIN_COPY[locale] ?? FIXED_ITIN_COPY.en;
    return (
      <div
        className={`tr-safe-top tr-root tr-plan-root mx-auto min-h-dvh w-full bg-[var(--tr-canvas)] pb-16 ${themeClass}`}
        data-locale={locale}
        style={surfaceStyle}
        data-tr-skin={surfaceSkin}
      >
        <div className="tr-safe-bottom mx-auto w-full max-w-xl px-4 pt-4">
          <header className="tr-plan-hero">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="tr-meta font-bold uppercase text-[var(--tr-plan-hero-muted)]">{fx.eyebrow}</p>
                <h1 className="tr-display mt-1 font-bold leading-tight text-[var(--tr-plan-hero-ink)]">
                  {tourTitle || copy.title}
                </h1>
              </div>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--tr-plan-hero-chip)] text-[var(--tr-plan-hero-ink)]">
                <IconJourney size={TR_ICON.nav} aria-hidden />
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {plan.tour.date && (
                <span className="tr-label inline-flex min-h-8 items-center gap-1.5 rounded-full bg-[var(--tr-plan-hero-chip)] px-3 font-semibold text-[var(--tr-plan-hero-ink)]">
                  <IconTime size={TR_ICON.meta} aria-hidden />
                  {copy.tourDay} {plan.tour.date}
                </span>
              )}
              {plan.tour.total_hours && (
                <span className="tr-label inline-flex min-h-8 items-center rounded-full bg-[var(--tr-plan-hero-chip)] px-3 font-semibold text-[var(--tr-plan-hero-ink)]">
                  {copy.courseHours(plan.tour.total_hours)}
                </span>
              )}
            </div>
          </header>

          <div className="tr-card mt-4 px-4 py-3.5">
            <p className="tr-card-text leading-relaxed text-[var(--tr-ink-2)]">{fx.note}</p>
          </div>

          {tourStops.length > 0 && (
            <div className="mt-4">
              <PlanStopCards
                stops={tourStops}
                locale={locale}
                canEdit={false}
                labels={{ add: copy.add, added: copy.added, details: ui.tourItinDetails }}
              />
            </div>
          )}

          <a
            href={roomHref}
            className="tr-plan-btn tr-plan-btn--primary tr-plan-btn--block tr-plan-btn--tap tr-body mt-5"
          >
            {copy.backToRoom}
          </a>
        </div>
      </div>
    );
  }

  return (
    /* R1 — this page opens standalone from an email link, so it has no app
       header/footer to inherit safe areas from: pad the top for the status
       bar and reserve the fixed submit bar + home indicator at the bottom
       (pb-32 alone left the last card under the bar on notched phones). */
    <div
      className={`tr-safe-top tr-root tr-plan-root mx-auto min-h-dvh w-full bg-[var(--tr-canvas)] ${themeClass}`}
      data-locale={locale}
      data-tr-skin={surfaceSkin}
      style={{ ...surfaceStyle, paddingBottom: 'calc(8rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="mx-auto w-full max-w-xl px-4 pt-4">
        {/* header */}
        <header className="tr-plan-hero">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="tr-meta font-bold uppercase text-[var(--tr-plan-hero-muted)]">Smart guide planner</p>
              <h1 className="tr-display mt-1 font-bold leading-tight text-[var(--tr-plan-hero-ink)]">{copy.title}</h1>
            </div>
            {/* P1-2 — the editing path had no persistent way back; roomHref was
                only linked from the read-only branch and the outcome banners. */}
            <a
              href={roomHref}
              aria-label="홈으로"
              data-testid="plan-home"
              className="tr-press flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--tr-plan-hero-chip)] text-[var(--tr-plan-hero-ink)]"
            >
              <IconTabMap size={TR_ICON.nav} aria-hidden />
            </a>
          </div>
          {/* P7.4 (H-6) — the masthead was 164px, 19% of the viewport, before
              any content began. Tightened rather than stripped: every chip the
              guest had is still here (P7-D7 — removing information reads as a
              feature disappearing), they just stop occupying a full band. */}
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {plan.tour.date && (
              <span className="tr-label inline-flex min-h-7 items-center gap-1.5 rounded-full bg-[var(--tr-plan-hero-chip)] px-2.5 font-semibold text-[var(--tr-plan-hero-ink)]">
                <IconTime size={TR_ICON.meta} aria-hidden />
                {copy.tourDay} {plan.tour.date}
              </span>
            )}
            {plan.tour.total_hours && (
              <span className="tr-label inline-flex min-h-7 items-center rounded-full bg-[var(--tr-plan-hero-chip)] px-2.5 font-semibold text-[var(--tr-plan-hero-ink)]">
                {copy.courseHours(plan.tour.total_hours)}
              </span>
            )}
            <span className="tr-label inline-flex min-h-7 items-center rounded-full bg-[var(--tr-plan-hero-chip)] px-2.5 text-[var(--tr-plan-hero-muted)]">
              {copy.kstNote}
            </span>
          </div>
        </header>

        {/* status banners */}
        {outcome === 'submitted' && (
          <div className="tr-card mt-4 border border-[var(--tr-safe)] px-4 py-3">
            <p className="tr-card-text font-medium text-[var(--tr-ink)]">{copy.submittedNote}</p>
            <a href={roomHref} className="tr-label mt-1 inline-block font-semibold text-[var(--tr-accent-deep)] underline">
              {copy.backToRoom}
            </a>
          </div>
        )}
        {outcome === 'delegated' && (
          <div className="tr-card mt-4 border border-[var(--tr-safe)] px-4 py-3">
            <p className="tr-card-text font-medium text-[var(--tr-ink)]">{copy.delegatedNote}</p>
            <a href={roomHref} className="tr-label mt-1 inline-block font-semibold text-[var(--tr-accent-deep)] underline">
              {copy.backToRoom}
            </a>
          </div>
        )}
        {isConfirmed && (
          <div className="tr-card mt-4 px-4 py-3">
            <p className="tr-card-text text-[var(--tr-ink)]">{copy.confirmedNote}</p>
          </div>
        )}
        {saveState === 'rate_limited' && (
          <div className="tr-card mt-4 border border-[var(--tr-danger-soft)] px-4 py-3" role="status">
            <p className="tr-card-text font-medium text-[var(--tr-danger)]">{ui.saveRateLimited}</p>
          </div>
        )}
        {!plan.viewer.can_edit && !isConfirmed && !plan.viewer.is_lead && (
          <div className="tr-card mt-4 px-4 py-3">
            <p className="tr-card-text text-[var(--tr-ink-2)]">{copy.memberReadOnly}</p>
            {/* 막다른 골목을 만들지 않는다: 같은 예약의 다른 기기(브라우저 ↔ PWA)가
                편집자로 잡혀 있을 뿐이면 여기서 넘겨받는다. */}
            <button
              type="button"
              onClick={() => void claimLead()}
              disabled={claimBusy}
              className="tr-plan-btn tr-plan-btn--soft tr-plan-btn--sm tr-label mt-2.5"
              data-testid="plan-claim-lead"
            >
              {copy.claimLead}
            </button>
          </div>
        )}

        {/* the day (shared stop editor / read-only list)
         *
         * 🔴 P7.4 (H-6) — this section used to sit at the BOTTOM, under the
         * hero, the tabs, the search field and a scrolling list of places:
         * roughly the last screenful of a 1,860px scroll. The guest came here
         * to build a day, and the day was the last thing on the page while the
         * tools for making it were the first.
         *
         * It is also the screen's ONE `.tr-card-hero` (H-1: exactly one per
         * screen, or the class stops meaning anything). It keeps its place when
         * empty on purpose — N4's lesson that an empty thing is a place to say
         * something, not a place to hide.
         */}
        {(stops.length > 0 || canEdit) && tab !== 'delegate' && (
          <section className="tr-card tr-card-hero mt-4 px-4 py-4" data-tr-phase={planDayPhase}>
            <div className="flex items-center justify-between gap-3">
              {/* 🔴 P7.3 (H-4) — 「내 하루」 is what the guest came here to make,
                  and it was set at the same 15px as every other section
                  heading. The screen's type usage sat 62% in its two smallest
                  steps (measured: tr-label 42 + tr-meta 26 of 110) with two
                  uses of the largest — "조잡함" was never too many small words,
                  it was no big ones. This is the protagonist; it gets 18px. */}
              <h2 className="tr-body-lg flex items-center gap-2 font-bold text-[var(--tr-ink)]">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl tr-plan-tile">
                  <IconJourney size={TR_ICON.chip} aria-hidden />
                </span>
                {copy.yourDay}
              </h2>
              {stops.length > 0 && (
                <span className="tr-meta rounded-full bg-[var(--tr-surface)] px-3 py-1.5 font-semibold text-[var(--tr-ink-3)] shadow-[var(--tr-rim),var(--tr-elev-1)]">
                  {copy.estimated(formatMinutes(totalEstimateMin))}
                </span>
              )}
            </div>

            {/* P7.5 (H-5) — `tr-stagger` below is the room's existing entrance,
                not a new one. CSS animations fire when an element MOUNTS, so
                that single class covers two of the four transitions the spec
                asks for: a course arriving animates every row in sequence, and
                a place added later animates only its own row. 45ms apart,
                capped at 300ms total. */}
            {stops.length === 0 ? (
              <p className="tr-label mt-2 text-[var(--tr-ink-2)]">{copy.emptyStops}</p>
            ) : (
              <ol className="tr-stagger mt-2 flex flex-col gap-2">
                {stops.map((stop, index) => {
                  const stopWarnings = warnings.filter((w) => w.stop_id === stop.id);
                  const expanded = expandedStopId === stop.id;
                  const meta = [
                    stop.arrival_planned ?? null,
                    stop.duration_min ? copy.minutes(stop.duration_min) : null,
                  ]
                    .filter(Boolean)
                    .join(' · ');
                  return (
                    /* `--flat` because these now sit INSIDE the hero card: a
                       shadow on a card within a card reads as a seam, not as
                       depth (H-1's third tier). */
                    <li key={stop.id} className="tr-card tr-card--flat overflow-hidden">
                      {/* P2 — the collapsed row is ONE line (~56px). It used to
                          carry a time input, a stay select, a full-width request
                          field and a three-tile action column at all times: ~430px
                          per stop, so four stops filled two screens. */}
                      <div className="flex items-center gap-2.5 px-3 py-2.5">
                        <span className="tr-label flex h-8 w-8 shrink-0 items-center justify-center rounded-xl tr-plan-tile font-bold">
                          {index + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => setExpandedStopId(expanded ? null : stop.id)}
                          aria-expanded={expanded}
                          disabled={!canEdit}
                          className="min-w-0 flex-1 text-left disabled:cursor-default"
                          data-testid={`plan-stop-row-${index + 1}`}
                        >
                          {/* P7.3 (H-4) — 13px → 15px. This is the only proper
                              noun on the screen: the place the guest is going.
                              It was set one step below the body text around it,
                              which is how a list of Jeju landmarks came to read
                              like a table of rows. The row stays one line
                              collapsed (P-D20 holds); only the protagonist
                              inside it grows. */}
                          <p className="tr-title text-cjk-safe font-semibold text-[var(--tr-ink)]">
                            {stop.title}
                            {stop.source === 'google' && (
                              <span className="tr-meta ml-1.5 rounded bg-[var(--tr-surface-2)] px-1.5 py-0.5 text-[var(--tr-ink-3)]">
                                Google
                              </span>
                            )}
                          </p>
                          {(meta || stopWarnings.length > 0) && (
                            <p className="tr-meta mt-0.5 flex items-center gap-1.5 text-[var(--tr-ink-3)]">
                              {stopWarnings.length > 0 && (
                                <IconWarn
                                  size={TR_ICON.meta}
                                  aria-hidden
                                  className="shrink-0 text-[var(--tr-danger)]"
                                />
                              )}
                              {meta || copy.timeLabel}
                            </p>
                          )}
                        </button>
                        {canEdit && (
                          <button
                            type="button"
                            aria-label={copy.stopActions}
                            onClick={() => setActionStopId(stop.id)}
                            className="flex h-11 w-9 shrink-0 items-center justify-center rounded-xl text-[var(--tr-ink-3)] active:bg-[var(--tr-surface-2)]"
                            data-testid={`plan-stop-actions-${index + 1}`}
                          >
                            <IconMore size={TR_ICON.action} aria-hidden />
                          </button>
                        )}
                      </div>

                      {canEdit && expanded && (
                        <div
                          className="tr-anim-panel-in border-t border-[var(--tr-hairline)] px-3 py-3"
                          data-testid={`plan-stop-detail-${index + 1}`}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="tr-meta flex items-center gap-1 text-[var(--tr-ink-3)]">
                              {copy.timeLabel}
                              <button
                                type="button"
                                onClick={() => setTimeSheetFor(stop.id)}
                                className="tr-plan-btn tr-plan-btn--quiet tr-plan-btn--sm tr-label font-semibold !text-[var(--tr-ink)]"
                                data-testid={`plan-stop-time-${index + 1}`}
                              >
                                {stop.arrival_planned ?? '--:--'}
                              </button>
                            </span>
                            <label className="tr-meta flex items-center gap-1 text-[var(--tr-ink-3)]">
                              {copy.durationLabel}
                              <select
                                value={stop.duration_min ?? 60}
                                onChange={(e) =>
                                  mutateStops((prev) =>
                                    prev.map((s) =>
                                      s.id === stop.id ? { ...s, duration_min: Number.parseInt(e.target.value, 10) } : s,
                                    ),
                                  )
                                }
                                className="tr-label min-h-9 rounded-xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-2.5 text-[var(--tr-ink)]"
                              >
                                {DURATION_OPTIONS.map((min) => (
                                  <option key={min} value={min}>
                                    {copy.minutes(min)}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                          <input
                            type="text"
                            value={stop.memo_guest ?? ''}
                            onChange={(e) =>
                              mutateStops((prev) =>
                                prev.map((s) => (s.id === stop.id ? { ...s, memo_guest: e.target.value } : s)),
                              )
                            }
                            placeholder={copy.memoPlaceholder}
                            maxLength={500}
                            className="tr-label mt-2 w-full rounded-xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-3 py-2 text-[var(--tr-ink)] placeholder:text-[var(--tr-ink-3)] focus:border-[var(--tr-accent)] focus:outline-none"
                          />
                        </div>
                      )}

                      {stopWarnings.map((w) => (
                        <p
                          key={w.code}
                          className="tr-meta flex items-center gap-1 border-t border-[var(--tr-hairline)] px-3 py-2 font-semibold text-[var(--tr-danger)]"
                        >
                          <IconWarn size={TR_ICON.meta} aria-hidden />
                          {w.code === 'closed'
                            ? copy.warnClosed(w.title ?? stop.title)
                            : copy.warnOutOfRegion(w.title ?? stop.title)}
                        </p>
                      ))}
                    </li>
                  );
                })}
              </ol>
            )}

            {/* P2 — reorder + remove moved off the row into the app's ⋯ sheet
                grammar (the same one the chat list uses). Three always-visible
                tiles per stop were the bulk of the old row's height. */}
            {actionStopId && canEdit && (() => {
              const idx = stops.findIndex((s) => s.id === actionStopId);
              if (idx < 0) return null;
              const close = () => setActionStopId(null);
              const act = (fn: (prev: EditorStop[]) => EditorStop[]) => {
                mutateStops(fn);
                close();
              };
              return (
                <Sheet open onClose={close} title={stops[idx].title} closeLabel={ui.cancel}>
                  <div className="tr-card divide-y divide-[var(--tr-hairline)] overflow-hidden">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() =>
                        act((prev) => {
                          const next = [...prev];
                          [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                          return next;
                        })
                      }
                      className="tr-card-text flex min-h-[52px] w-full items-center gap-3 px-4 text-left text-[var(--tr-ink)] disabled:opacity-40"
                      data-testid="plan-stop-move-up"
                    >
                      <IconMoveUp size={TR_ICON.action} aria-hidden />
                      {copy.moveUp}
                    </button>
                    <button
                      type="button"
                      disabled={idx === stops.length - 1}
                      onClick={() =>
                        act((prev) => {
                          const next = [...prev];
                          [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                          return next;
                        })
                      }
                      className="tr-card-text flex min-h-[52px] w-full items-center gap-3 px-4 text-left text-[var(--tr-ink)] disabled:opacity-40"
                      data-testid="plan-stop-move-down"
                    >
                      <IconMoveDown size={TR_ICON.action} aria-hidden />
                      {copy.moveDown}
                    </button>
                    <button
                      type="button"
                      onClick={() => act((prev) => prev.filter((s) => s.id !== actionStopId))}
                      className="tr-card-text flex min-h-[52px] w-full items-center gap-3 px-4 text-left font-semibold text-[var(--tr-danger)]"
                      data-testid="plan-stop-remove"
                    >
                      <IconTrash size={TR_ICON.action} aria-hidden />
                      {copy.removeStop}
                    </button>
                  </div>
                </Sheet>
              );
            })()}

            {/* P3 — one wheel serves every time in this screen. The native
                picker leaked the device locale into a 10-locale planner and drew
                OS chrome inside an app that has its own. */}
            {timeSheetFor && canEdit && (() => {
              const forDeparture = timeSheetFor === 'departure';
              const stop = forDeparture ? null : stops.find((s) => s.id === timeSheetFor);
              if (!forDeparture && !stop) return null;
              const current = forDeparture ? (departureTime ?? '') : (stop?.arrival_planned ?? '');
              const commit = (hhmm: string) => {
                if (forDeparture) {
                  mutateDeparture(hhmm);
                } else {
                  mutateStops((prev) =>
                    prev.map((s) => (s.id === timeSheetFor ? { ...s, arrival_planned: hhmm } : s)),
                  );
                }
              };
              return (
                <Sheet
                  open
                  onClose={() => setTimeSheetFor(null)}
                  title={forDeparture ? copy.departureTitle : (stop?.title ?? copy.timeLabel)}
                  closeLabel={ui.cancel}
                >
                  <TimeWheel
                    value={current}
                    onChange={commit}
                    restAt={WHEEL_REST}
                    testId="plan-time-wheel"
                  />
                  {/* 🔴 The wheel shows its RESTING row highlighted but does not
                      commit it — by design, so an unset field is not silently
                      given a value (TimeWheel's own contract: "the first scroll
                      or tap commits"). The cost was a trap: the sheet opens
                      looking like 09:00 is chosen, and the two ways out were
                      ✕ and [시간 지우기], neither of which keeps it. A guest who
                      wanted the default had no way to say so.
                      That mattered beyond one field: departure_time is what
                      gates the countdown AND the guest's "시간 추가" request, so
                      the trap quietly disabled the whole overtime path (live:
                      zero plans had it set). */}
                  <button
                    type="button"
                    onClick={() => {
                      commit(current && /^\d{2}:\d{2}$/.test(current) ? current : WHEEL_REST);
                      setTimeSheetFor(null);
                    }}
                    className="tr-plan-btn tr-plan-btn--primary tr-plan-btn--block tr-plan-btn--tap tr-body mt-3"
                    data-testid="plan-time-confirm"
                  >
                    {copy.timeConfirm}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (forDeparture) mutateDeparture(null);
                      else
                        mutateStops((prev) =>
                          prev.map((s) => (s.id === timeSheetFor ? { ...s, arrival_planned: null } : s)),
                        );
                      setTimeSheetFor(null);
                    }}
                    className="tr-plan-btn tr-plan-btn--quiet tr-plan-btn--block tr-plan-btn--tap tr-label mt-2"
                    data-testid="plan-time-clear"
                  >
                    {copy.timeClear}
                  </button>
                </Sheet>
              );
            })()}

            {/* plan-wide warnings (overrun) */}
            {warnings.some((w) => w.code === 'overrun') && plan.tour.total_hours && (
              <div className="tr-card mt-3 border border-[var(--tr-danger-soft,#f3d6d6)] px-4 py-3">
                <p className="tr-meta font-bold uppercase tracking-wide text-[var(--tr-danger)]">{copy.warningsTitle}</p>
                {warnings
                  .filter((w) => w.code === 'overrun')
                  .map((w, i) => (
                    <p key={i} className="tr-label mt-1 text-[var(--tr-ink)]">
                      {copy.warnOverrun(
                        formatMinutes(Number(w.detail.over_min) || 0),
                        copy.courseHours(plan.tour.total_hours as number),
                      )}
                    </p>
                  ))}
              </div>
            )}

            {/* plan-wide notice (Jeju cross-island 동+서/남) — notice only, never blocks */}
            {warnings
              .filter((w) => w.code === 'cross_island')
              .map((w, i) => (
                <div
                  key={`cross-island-${i}`}
                  className="tr-card mt-3 border border-[var(--tr-danger-soft,#f3d6d6)] px-4 py-3"
                >
                  <p className="tr-meta font-bold uppercase tracking-wide text-[var(--tr-danger)]">
                    {copy.warningsTitle}
                  </p>
                  <p className="tr-label mt-1 text-[var(--tr-ink)]">
                    {copy.warnCrossIsland(`₩${Number(w.detail.surcharge_krw ?? 0).toLocaleString()}`)}
                  </p>
                </div>
              ))}
          </section>
        )}

        {/* tabs */}
        {canEdit && !isConfirmed && (
          <>
            {/* A segmented control, not three CTAs: one recessed track with a
                single raised thumb. Painting the active tab in the full accent
                made three loud greens compete with the real submit button. */}
            <div role="tablist" className="tr-plan-seg mt-5 grid grid-cols-3 gap-1">
              {tabItems.map(([key, label, Icon]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={tab === key}
                  onClick={() => setTab(key)}
                  className="tr-plan-seg-item tr-label text-cjk-safe flex min-h-[42px] items-center justify-center gap-1.5 px-2 text-center font-bold"
                >
                  {/* 🔴 `shrink-0`: the SVG is a flex child, so once P7.1b let
                      --tr-font-scale reach this screen the labels grew and flex
                      squeezed the icons to slivers at steps 4-5 — visibly
                      narrower than tall, and only on the two unselected tabs
                      (the selected one has room). Nobody had seen it because
                      the setting had never worked here. */}
                  <Icon size={TR_ICON.meta} strokeWidth={TR_STROKE.small} aria-hidden className="shrink-0" />
                  {label}
                </button>
              ))}
            </div>

            {/* tab ① courses */}
            {tab === 'courses' && (
              <div className="mt-3 flex flex-col gap-3">
                {/* P0 — 코스 택1 상품은 "일정"이 아니라 "선택지"를 싣고 온다.
                    정류지 카드로 렌더하면 네 코스가 네 관광지가 된다. */}
                {courseOptions ? (
                  <section aria-labelledby="plan-course-options">
                    <h2
                      id="plan-course-options"
                      className="tr-title font-bold text-[var(--tr-ink)]"
                    >
                      {ui.courseOptionTitle}
                    </h2>
                    <p className="tr-label mt-1 leading-relaxed text-[var(--tr-ink-2)]">
                      {ui.courseOptionSub}
                    </p>
                    <div className="mt-3 flex flex-col gap-3">
                      {courseOptions.map((course) => {
                        const places = course.poiKeys
                          .map((key) => poiByKey.get(key))
                          .filter(Boolean)
                          .map((poi) => poiName(poi!, locale));
                        const preview = (
                          course.isCustom
                            ? course.candidatePoiKeys
                                .map((key) => poiByKey.get(key))
                                .filter(Boolean)
                                .map((poi) => poiName(poi!, locale))
                            : places
                        )
                          .slice(0, 4)
                          .join(' · ');
                        return (
                          <article
                            key={course.index}
                            className="tr-card tr-plan-course-card overflow-hidden"
                            data-testid={`plan-course-option-${course.index}`}
                          >
                            {/* 🔴 P7.6 (P7-D3 ② / H-6) — this is where the guest
                                makes the most emotional decision of the trip:
                                「UNESCO & K-Drama Coast」 vs 「Beaches, Tea &
                                Cafe」 vs 「Waterfalls & Volcanic Coast」. The
                                three cards carried the SAME icon, the SAME
                                layout and the SAME button, and not one photo of
                                the places involved — so the only thing to
                                choose on was the name.
                                Three thumbnails from the route's own POIs, so
                                the cards differ at a glance. Photoless POIs
                                fall to their tinted initial (P7.1), which still
                                differs card to card rather than reading as an
                                unfinished screen. */}
                            {courseHeroPois.get(course.index)?.length ? (
                              <div className="flex gap-0.5" aria-hidden>
                                {courseHeroPois.get(course.index)!.map((entry, i) => (
                                  <PoiThumb
                                    key={`${course.index}-${entry.key}-${i}`}
                                    poi={entry.poi}
                                    seed={entry.key}
                                    name={entry.name}
                                    fill
                                    rounded=""
                                    className="h-[92px]"
                                  />
                                ))}
                              </div>
                            ) : null}
                            {/* The generic journey icon is gone from cards that
                                have a photo strip: it was identical on all
                                three, which is half of why they read as the
                                same card (§B-1). The strip is the identity now,
                                and the title gets the width back. Cards without
                                resolvable POIs keep the icon so they are not
                                left with a bare title. */}
                            <div className="flex items-start gap-3 px-4 pt-3.5">
                              {!courseHeroPois.get(course.index)?.length && (
                                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl tr-plan-tile">
                                  <IconJourney size={TR_ICON.action} aria-hidden />
                                </span>
                              )}
                              <div className="min-w-0 flex-1">
                                <h3 className="tr-title font-bold leading-snug text-[var(--tr-ink)]">
                                  {course.name}
                                </h3>
                                {preview && (
                                  <p className="tr-label tr-plan-line-clamp-2 mt-1.5 leading-relaxed text-[var(--tr-ink-2)]">
                                    {preview}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-2 px-4 pb-4">
                              {!course.isCustom && (
                                <span className="tr-label inline-flex min-h-8 items-center rounded-full bg-[var(--tr-surface-2)] px-3 text-[var(--tr-ink-2)]">
                                  {copy.courseStops(places.length)}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => applyCourseOption(course)}
                                /* 장소 목록이 아직이면 누를 수 없게 한다. 예전에는
                                   눌려도 poiByKey가 비어 조용히 아무 일도 안 일어났다. */
                                disabled={!canEdit || (!course.isCustom && poisState !== 'ready')}
                                /* 🔴 P7.2 (H-3) — this button fills the guest's
                                   entire day, and it was `--sm` (36px/12px)
                                   while 「Add」, which adds one place, was 44px.
                                   The CSS had rationed a loud tier to real
                                   commits and the call site put the compact
                                   modifier on the biggest commit there is.
                                   Hero tier now; `plannerButtonHierarchy` keeps
                                   it that way. */
                                className="tr-plan-btn tr-plan-btn--hero tr-plan-btn--block ml-auto"
                                data-testid={`plan-course-apply-${course.index}`}
                              >
                                {course.isCustom ? ui.courseOptionCustom : ui.courseOptionApply}
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                ) : (
                <PlanTourItinerary
                  stops={tourStops}
                  locale={locale}
                  tourTitle={tourTitle}
                  canEdit
                  addedKeys={new Set(stops.map((s) => s.poi_key).filter(Boolean) as string[])}
                  labels={{
                    sectionTitle: ui.tourItinTitle,
                    sectionSub: ui.tourItinSub,
                    applyAll: ui.tourItinApplyAll,
                    add: ui.tourItinAdd,
                    added: ui.tourItinAdded,
                    details: ui.tourItinDetails,
                    stopsCount: copy.courseStops,
                  }}
                  onApplyAll={applyTourItinerary}
                  onAddStop={addTourStop}
                />
                )}
                {templatesState === 'loading' && (
                  <div className="tr-card px-4 py-4" role="status">
                    <p className="tr-card-text font-medium text-[var(--tr-ink-2)]">{ui.templatesLoading}</p>
                  </div>
                )}
                {templatesState === 'error' && (
                  <div className="tr-card border border-[var(--tr-danger-soft)] px-4 py-4" role="status">
                    <p className="tr-card-text font-medium text-[var(--tr-danger)]">{ui.templatesError}</p>
                  </div>
                )}
                {templatesState === 'ready' && templates.length === 0 && (
                  <div className="tr-card px-4 py-4" role="status">
                    <p className="tr-card-text font-medium text-[var(--tr-ink-2)]">{ui.templatesEmpty}</p>
                  </div>
                )}
                {templates.map((template, index) => {
                  const title =
                    template.title_i18n?.[locale] || template.title_i18n?.en || Object.values(template.title_i18n ?? {})[0] || '';
                  const preview = toEditorStops(template.stops, locale)
                    .slice(0, 4)
                    .map((s) => s.title)
                    .join(' · ');
                  return (
                    <article key={template.id} className="tr-card tr-plan-course-card px-4 py-4">
                      <div className="flex items-start gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl tr-plan-tile">
                          <IconJourney size={TR_ICON.action} aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="tr-meta rounded-full bg-[var(--tr-surface-2)] px-2 py-0.5 font-bold text-[var(--tr-ink-3)]">
                              #{index + 1}
                            </span>
                            <span className="tr-meta font-semibold uppercase text-[var(--tr-accent-deep)]">{copy.tabCourses}</span>
                          </div>
                          <h2 className="tr-title mt-1 font-bold leading-snug text-[var(--tr-ink)]">{title}</h2>
                          {preview && (
                            <p className="tr-label tr-plan-line-clamp-2 mt-1.5 leading-relaxed text-[var(--tr-ink-2)]">
                              {preview}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="tr-label inline-flex min-h-8 items-center rounded-full bg-[var(--tr-surface-2)] px-3 text-[var(--tr-ink-2)]">
                          {copy.courseStops(template.stops?.length ?? 0)}
                        </span>
                        {template.total_hours && (
                          <span className="tr-label inline-flex min-h-8 items-center gap-1 rounded-full bg-[var(--tr-surface-2)] px-3 text-[var(--tr-ink-2)]">
                            <IconTime size={TR_ICON.meta} aria-hidden />
                            {copy.courseHours(template.total_hours)}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setPreviewTemplate(template)}
                        /* Previewing commits nothing — soft tier. The loud one
                           lives in the preview sheet's footer, on the button
                           that actually replaces the day. */
                        className="tr-plan-btn tr-plan-btn--soft tr-plan-btn--block tr-plan-btn--tap tr-label mt-3"
                      >
                        <IconAsk size={TR_ICON.chip} aria-hidden />
                        {ui.previewCourse}
                      </button>
                    </article>
                  );
                })}
              </div>
            )}

            {/* tab ② pick */}
            {tab === 'pick' && (
              <div className="mt-3">
                <div className="relative">
                  <IconAsk
                    size={TR_ICON.chip}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--tr-ink-3)]"
                    aria-hidden
                  />
                  <input
                    type="search"
                    value={poiQuery}
                    onChange={(e) => setPoiQuery(e.target.value)}
                    placeholder={copy.searchPlaceholder}
                    className="tr-card-text w-full rounded-[var(--tr-radius-input)] border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-10 py-3 text-[var(--tr-ink)] shadow-[var(--tr-rim),var(--tr-elev-1)] placeholder:text-[var(--tr-ink-3)] focus:border-[var(--tr-accent)] focus:outline-none"
                  />
                </div>
                {poisState === 'loading' && (
                  <div className="tr-card mt-2 px-4 py-3" role="status">
                    <p className="tr-card-text font-medium text-[var(--tr-ink-2)]">{ui.placesLoading}</p>
                  </div>
                )}
                {poisState === 'error' && (
                  <div className="tr-card mt-2 border border-[var(--tr-danger-soft)] px-4 py-3" role="status">
                    <p className="tr-card-text font-medium text-[var(--tr-danger)]">{ui.placesError}</p>
                  </div>
                )}
                {poisState === 'ready' && filteredPois.length === 0 && (
                  <div className="tr-card mt-2 px-4 py-3" role="status">
                    <p className="tr-card-text font-medium text-[var(--tr-ink-2)]">{ui.placesEmpty}</p>
                  </div>
                )}
                <div className="mt-2 flex max-h-72 flex-col gap-1.5 overflow-y-auto pr-1">
                  {filteredPois.map(({ poi, name, added }) => (
                    <div key={poi.poi_key} className="tr-card flex items-center gap-3 px-3 py-3">
                      <PoiThumb poi={poi} seed={poi.poi_key} name={name} className="h-12 w-12" />
                      <div className="min-w-0 flex-1">
                        {/* P7.6 (H-6) — `truncate` cut place names mid-word:
                            「Jeju Tangerine Picking Experi…」. A guest choosing
                            between places cannot choose on a name that stops.
                            Two lines, and `text-cjk-body` so Korean/Japanese/
                            Chinese break at word boundaries rather than
                            anywhere (the repo's standing CJK rule). */}
                        <p className="tr-card-text tr-plan-line-clamp-2 text-cjk-body font-medium text-[var(--tr-ink)]">
                          {name}
                        </p>
                        <p className="tr-meta text-[var(--tr-ink-3)]">
                          {poi.category ?? ''}
                          {poi.default_stay_minutes ? ` · ${copy.minutes(poi.default_stay_minutes)}` : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => addPoiStop(poi)}
                        disabled={added}
                        className={`tr-plan-btn tr-plan-btn--sm tr-plan-btn--tap tr-label text-cjk-safe shrink-0 ${
                          added ? 'tr-plan-btn--done' : 'tr-plan-btn--soft'
                        }`}
                      >
                        {added ? <IconSuccess size={TR_ICON.meta} aria-hidden /> : <IconPlus size={TR_ICON.meta} aria-hidden />}
                        {added ? copy.added : copy.add}
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setGoogleOpen((v) => !v)}
                  aria-expanded={googleOpen}
                  className="tr-plan-btn tr-plan-btn--quiet tr-plan-btn--sm tr-plan-btn--tap tr-label mt-3"
                >
                  <IconArrived size={TR_ICON.meta} aria-hidden />
                  {copy.googleToggle}
                </button>
                {googleOpen && (
                  <div className="mt-2">
                    <GooglePlaceSearch
                      region={plan.tour.region}
                      placeholder={copy.googlePlaceholder}
                      loadingLabel={copy.googleLoading}
                      errorLabel={ui.googleError}
                      onPick={addGooglePick}
                    />
                  </div>
                )}
              </div>
            )}

            {/* tab ③ delegate */}
            {tab === 'delegate' && (
              <div className="tr-card mt-3 px-4 py-5">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl tr-plan-tile">
                  <IconConcierge size={TR_ICON.action} aria-hidden />
                </span>
                <p className="tr-title mt-3 font-bold leading-snug text-[var(--tr-ink)]">{copy.delegateTitle}</p>
                <p className="tr-card-text mt-1.5 leading-relaxed text-[var(--tr-ink-2)]">{copy.delegateDesc}</p>
                <button
                  type="button"
                  onClick={() => void delegatePlan()}
                  className="tr-plan-btn tr-plan-btn--primary tr-plan-btn--block tr-plan-btn--tap tr-body mt-4"
                >
                  <IconConcierge size={TR_ICON.chip} aria-hidden />
                  {copy.delegateCta}
                </button>
              </div>
            )}
          </>
        )}


        {/* needs (A10) */}
        {canEdit && !isConfirmed && (
          <section className="tr-card mt-6 px-4 py-4">
            <h2 className="tr-body flex items-center gap-2 font-bold text-[var(--tr-ink)]">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl tr-plan-tile">
                <IconPerson size={TR_ICON.chip} aria-hidden />
              </span>
              {copy.needsTitle}
            </h2>
            <p className="tr-meta mt-0.5 text-[var(--tr-ink-3)]">{copy.needsHint}</p>

            {/* D4 — plan-level daily departure time (KST). Countdown target =
                departure + base included hours (Jeju 9h / Busan 8h). */}
            <div className="mt-3">
              {seat && (
                <div
                  className="mb-3 flex items-center gap-2 rounded-xl bg-[var(--tr-surface-2)] px-3 py-2.5"
                  data-testid="plan-my-seat"
                >
                  <IconPerson size={TR_ICON.chip} aria-hidden className="shrink-0 text-[var(--tr-ink-3)]" />
                  <span className="tr-meta font-semibold uppercase tracking-wide text-[var(--tr-ink-3)]">
                    {copy.seatTitle}
                  </span>
                  <span className="tr-card-text text-cjk-body ml-auto text-right text-[var(--tr-ink)]">
                    {seat.state === 'assigned' && seat.seat_number
                      ? copy.seatAssigned(seat.seat_number)
                      : seat.state === 'pending'
                        ? copy.seatPending
                        : copy.seatNone}
                  </span>
                </div>
              )}
              <p className="tr-meta font-semibold uppercase tracking-wide text-[var(--tr-ink-3)]">
                {copy.departureTitle}
              </p>
              <button
                type="button"
                onClick={() => setTimeSheetFor('departure')}
                disabled={!canEdit}
                aria-label={copy.departureTitle}
                className="tr-plan-btn tr-plan-btn--quiet tr-plan-btn--sm tr-label mt-2 w-32 font-semibold !text-[var(--tr-ink)]"
                data-testid="plan-departure-time"
              >
                {departureTime ?? '--:--'}
              </button>
              <p className="tr-meta mt-1 text-[var(--tr-ink-3)]">{copy.departureHint}</p>
            </div>

            <div className="mt-3 flex flex-wrap gap-3">
              <label className="tr-label flex items-center gap-2 text-[var(--tr-ink-2)]">
                {copy.adults}
                <input
                  type="number"
                  min={0}
                  max={40}
                  value={needs.adults}
                  onChange={(e) => mutateNeeds({ adults: Math.max(0, Number.parseInt(e.target.value, 10) || 0) })}
                  className="tr-label min-h-9 w-16 rounded-xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-2 text-[var(--tr-ink)]"
                />
              </label>
              <label className="tr-label flex items-center gap-2 text-[var(--tr-ink-2)]">
                {copy.children}
                <input
                  type="number"
                  min={0}
                  max={40}
                  value={needs.children}
                  onChange={(e) => mutateNeeds({ children: Math.max(0, Number.parseInt(e.target.value, 10) || 0) })}
                  className="tr-label min-h-9 w-16 rounded-xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-2 text-[var(--tr-ink)]"
                />
              </label>
              {needs.children > 0 && (
                <label className="tr-label flex items-center gap-2 text-[var(--tr-ink-2)]">
                  {copy.childAges}
                  <input
                    type="text"
                    value={needs.child_ages}
                    onChange={(e) => mutateNeeds({ child_ages: e.target.value })}
                    placeholder={copy.childAgesPlaceholder}
                    className="tr-label min-h-9 w-24 rounded-xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-2 text-[var(--tr-ink)]"
                  />
                </label>
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {(
                [
                  ['stroller', copy.stroller],
                  ['wheelchair', copy.wheelchair],
                  ['luggage', copy.luggage],
                ] as Array<['stroller' | 'wheelchair' | 'luggage', string]>
              ).map(([key, label]) => (
                <button
                  type="button"
                  key={key}
                  onClick={() => mutateNeeds({ [key]: !needs[key] } as Partial<NeedsState>)}
                  aria-pressed={needs[key]}
                  /* Selected = accent WASH + accent hairline (.tr-plan-chip
                     reads aria-pressed). A dozen solid accent pills in a row
                     was the other half of the "온통 진 녹색" report. */
                  className="tr-plan-chip tr-label text-cjk-safe"
                >
                  {label}
                </button>
              ))}
            </div>

            <p className="tr-meta mt-3 flex items-center gap-1.5 font-semibold uppercase text-[var(--tr-ink-3)]">
              <IconDining size={TR_ICON.meta} aria-hidden />
              {copy.dietaryTitle}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {Object.entries(copy.dietary).map(([key, label]) => {
                const active = needs.dietary.includes(key);
                return (
                  <button
                    type="button"
                    key={key}
                    onClick={() =>
                      mutateNeeds({
                        dietary: active ? needs.dietary.filter((d) => d !== key) : [...needs.dietary, key],
                      })
                    }
                    aria-pressed={active}
                    className="tr-plan-chip tr-label text-cjk-safe"
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <input
              type="text"
              value={needs.allergy_note}
              onChange={(e) => mutateNeeds({ allergy_note: e.target.value })}
              placeholder={copy.allergyPlaceholder}
              maxLength={300}
              className="tr-label mt-2 w-full rounded-xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-3 py-2 text-[var(--tr-ink)] placeholder:text-[var(--tr-ink-3)] focus:border-[var(--tr-accent)] focus:outline-none"
            />

            <p className="tr-meta mt-3 font-semibold uppercase tracking-wide text-[var(--tr-ink-3)]">{copy.paceTitle}</p>
            <div className="mt-1.5 flex gap-2">
              {(Object.entries(copy.pace) as Array<['relaxed' | 'standard' | 'packed', string]>).map(([key, label]) => (
                <button
                  type="button"
                  key={key}
                  onClick={() => mutateNeeds({ pace: key })}
                  aria-pressed={needs.pace === key}
                  className="tr-plan-chip tr-label text-cjk-safe flex-1"
                >
                  {label}
                </button>
              ))}
            </div>

            <textarea
              value={needs.note}
              onChange={(e) => mutateNeeds({ note: e.target.value })}
              placeholder={copy.notePlaceholder}
              maxLength={500}
              rows={2}
              className="tr-label mt-3 w-full rounded-xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-3 py-2 text-[var(--tr-ink)] placeholder:text-[var(--tr-ink-3)] focus:border-[var(--tr-accent)] focus:outline-none"
            />
          </section>
        )}

        {/* W4.3 / F1 — the Korean restaurant card, derived live from needs. */}
        {(() => {
          const lines = koreanAllergyCardLines(needsPayload(needs));
          if (!lines) return null;
          return (
            <section className="tr-card mt-6 px-4 py-4" data-testid="allergy-card">
              <h2 className="tr-body font-bold text-[var(--tr-ink)]">{copy.allergyCardTitle}</h2>
              <p className="tr-meta mt-0.5 text-[var(--tr-ink-3)]">{copy.allergyCardHint}</p>
              <div className="mt-3 rounded-xl border-2 border-[var(--tr-accent)] bg-[var(--tr-surface)] px-4 py-4">
                {lines.map((line, i) => (
                  <p
                    key={i}
                    className={
                      i === 0
                        ? 'tr-title font-bold leading-relaxed text-[var(--tr-ink)]'
                        : 'tr-body-lg mt-1.5 font-semibold leading-relaxed text-[var(--tr-ink)]'
                    }
                  >
                    {line}
                  </p>
                ))}
              </div>
            </section>
          );
        })()}
      </div>

      {previewTemplate && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 px-0" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label={ui.previewClose}
            className="absolute inset-0 cursor-default"
            onClick={closePreview}
          />
          <section className="relative max-h-[86dvh] w-full max-w-xl overflow-y-auto rounded-t-[28px] border border-[var(--tr-hairline)] bg-[var(--tr-surface)] shadow-[var(--tr-shadow-overlay)]">
            <div className="sticky top-0 z-10 border-b border-[var(--tr-hairline)] bg-[var(--tr-surface)]/95 px-4 py-3 backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="tr-meta font-bold uppercase tracking-wide text-[var(--tr-accent-deep)]">{ui.previewTitle}</p>
                  <h2 className="tr-body-lg mt-0.5 font-bold leading-snug text-[var(--tr-ink)]">
                    {previewTemplate.title_i18n?.[locale] ||
                      previewTemplate.title_i18n?.en ||
                      Object.values(previewTemplate.title_i18n ?? {})[0] ||
                      copy.tabCourses}
                  </h2>
                </div>
                <button
                  type="button"
                  aria-label={ui.previewClose}
                  onClick={closePreview}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--tr-surface-2)] text-[var(--tr-ink-2)]"
                >
                  <IconClose size={TR_ICON.chip} aria-hidden />
                </button>
              </div>
            </div>

            <div className="px-4 pb-4 pt-3">
              <div className="grid grid-cols-3 gap-2">
                {[
                  [ui.previewStops, String(previewRichStops.length || previewStops.length)],
                  [
                    ui.previewTotal,
                    previewTemplate.total_hours
                      ? copy.courseHours(previewTemplate.total_hours)
                      : formatMinutes(previewStayMin + previewDriveMin),
                  ],
                  [ui.previewDriving, previewDriveMin > 0 ? formatMinutes(previewDriveMin) : '—'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-[var(--tr-hairline)] bg-[var(--tr-surface-2)] px-3 py-2">
                    <p className="tr-meta font-bold uppercase tracking-wide text-[var(--tr-ink-3)]">{label}</p>
                    <p className="tr-label mt-0.5 truncate font-semibold text-[var(--tr-ink)]">{value}</p>
                  </div>
                ))}
              </div>

              {previewRichStops.length > 0 ? (
                // Rich itinerary from the course's origin_tour_slug — same photo
                // cards + tap→detail drawer as the product page (§ 사용자 요청).
                <div className="mt-4">
                  <PlanStopCards
                    stops={previewRichStops}
                    locale={locale}
                    canEdit={false}
                    labels={{ add: ui.tourItinAdd, added: ui.tourItinAdded, details: ui.tourItinDetails }}
                  />
                </div>
              ) : (
                <ol className="mt-4 flex flex-col gap-2">
                  {previewStops.map((stop, index) => {
                    const stopPoi = stop.poi_key ? poiByKey.get(stop.poi_key) : undefined;
                    return (
                      <li key={stop.id} className="flex gap-3 rounded-2xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] p-3">
                        <PoiThumb
                          poi={stopPoi}
                          seed={stop.poi_key ?? stop.id}
                          name={stop.title}
                          className="h-16 w-16"
                          rounded="rounded-xl"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="tr-meta flex h-6 w-6 shrink-0 items-center justify-center rounded-full tr-plan-tile font-bold">
                              {index + 1}
                            </span>
                            <p className="tr-card-text truncate font-bold text-[var(--tr-ink)]">{stop.title}</p>
                          </div>
                          <p className="tr-meta mt-1 text-[var(--tr-ink-3)]">
                            {stop.duration_min ? copy.minutes(stop.duration_min) : copy.minutes(60)}
                            {stop.stop_type ? ` · ${stop.stop_type}` : ''}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>

            <div className="tr-safe-bottom sticky bottom-0 z-20 border-t border-[var(--tr-hairline)] bg-[var(--tr-surface)]/95 px-4 py-3 backdrop-blur">
              {stops.length > 0 && replaceArmed ? (
                <div>
                  <p className="tr-label text-center font-medium text-[var(--tr-ink-2)]">{copy.replaceConfirm}</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setReplaceArmed(false)}
                      className="tr-plan-btn tr-plan-btn--quiet tr-plan-btn--tap tr-body flex-1"
                    >
                      {ui.cancel}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        applyTemplate(previewTemplate);
                        closePreview();
                      }}
                      className="tr-plan-btn tr-plan-btn--primary tr-plan-btn--tap tr-body flex-1"
                    >
                      <IconSuccess size={TR_ICON.chip} aria-hidden />
                      {ui.replaceApply}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (stops.length > 0) {
                      setReplaceArmed(true);
                    } else {
                      applyTemplate(previewTemplate);
                      closePreview();
                    }
                  }}
                  className="tr-plan-btn tr-plan-btn--primary tr-plan-btn--block tr-plan-btn--tap tr-body"
                >
                  <IconSuccess size={TR_ICON.chip} aria-hidden />
                  {copy.useCourse}
                </button>
              )}
            </div>
          </section>
        </div>
      )}

      {/* sticky submit bar
       *
       * bottom-dock: the planner is a standalone page — no composer, no tab bar —
       * so this bar owns the bottom edge legitimately. Clearance for it is
       * reserved on the scroll container above (search `paddingBottom: 'calc(8rem`),
       * without which the last stop card sits under the bar and cannot be tapped.
       * Move one and you must move the other. */}
      {canEdit && !isConfirmed && tab !== 'delegate' && stops.length > 0 && (
        <div className="tr-safe-bottom fixed inset-x-0 bottom-0 border-t border-[var(--tr-hairline)] bg-[var(--tr-surface)]/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex w-full max-w-xl items-center gap-3">
            <span className="tr-label min-w-0 flex-1 truncate font-semibold text-[var(--tr-ink-3)]" aria-live="polite">
              {saveState === 'saving' && copy.saving}
              {saveState === 'saved' && copy.saved}
              {saveState === 'error' && copy.saveError}
              {saveState === 'rate_limited' && ui.saveRateLimited}
            </span>
            <button
              type="button"
              onClick={() => void submitPlan()}
              disabled={stops.length === 0 || saveState === 'saving' || submitBusy}
              /* The one loud button on the screen — this is the commit, so it
                 takes the hero tier (P7.2 H-3). It shares the bar with a status
                 line rather than owning a whole row, so it stays inline-sized;
                 the tier gives it the height and ring, not the width. */
              className="tr-plan-btn tr-plan-btn--hero shrink-0 px-5"
              data-testid="plan-submit"
            >
              <IconSubmit size={TR_ICON.chip} aria-hidden />
              {saveState === 'saving' || submitBusy ? copy.submitting : copy.submit}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
