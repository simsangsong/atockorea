/**
 * U-8 — saved filter views for admin lists (spec §P). Pure preset logic only:
 * parse/serialize/upsert/remove named filter snapshots + active-match check.
 * localStorage I/O lives in the SavedViews component so this module stays pure
 * and unit-testable.
 */

export type SavedView = {
  id: string;
  name: string;
  filters: Record<string, string>;
};

/** Bound localStorage growth — keep the most-recent N presets. */
export const MAX_SAVED_VIEWS = 12;

/** Deterministic id (slug) from a display name. Dedupe key = id. */
export function viewId(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9가-힣-]/g, '')
    .slice(0, 48);
  return slug || 'view';
}

/** Drop empty values so a view stores only meaningful filters. */
function cleanFilters(filters: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (typeof value === 'string' && value !== '') out[key] = value;
  }
  return out;
}

/** Pure: parse persisted JSON into a validated SavedView[] (drops malformed). */
export function parseSavedViews(raw: string | null | undefined): SavedView[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];

  const out: SavedView[] = [];
  const seen = new Set<string>();
  for (const item of data) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const name = typeof obj.name === 'string' ? obj.name.trim() : '';
    if (!name) continue;
    const id = typeof obj.id === 'string' && obj.id ? obj.id : viewId(name);
    if (seen.has(id)) continue;

    const filters: Record<string, string> = {};
    if (obj.filters && typeof obj.filters === 'object') {
      for (const [k, v] of Object.entries(obj.filters as Record<string, unknown>)) {
        if (typeof v === 'string') filters[k] = v;
      }
    }
    seen.add(id);
    out.push({ id, name, filters });
    if (out.length >= MAX_SAVED_VIEWS) break;
  }
  return out;
}

export function serializeSavedViews(views: SavedView[]): string {
  return JSON.stringify(views.slice(0, MAX_SAVED_VIEWS));
}

/**
 * Pure: add (or replace by id) a view from a name + the current filters.
 * Newest first; capped at MAX_SAVED_VIEWS. Empty name is a no-op (returns the
 * same array reference so callers can short-circuit).
 */
export function upsertSavedView(
  views: SavedView[],
  name: string,
  filters: Record<string, string>,
): SavedView[] {
  const trimmed = name.trim();
  if (!trimmed) return views;
  const id = viewId(trimmed);
  const next = views.filter((v) => v.id !== id);
  next.unshift({ id, name: trimmed, filters: cleanFilters(filters) });
  return next.slice(0, MAX_SAVED_VIEWS);
}

export function removeSavedView(views: SavedView[], id: string): SavedView[] {
  return views.filter((v) => v.id !== id);
}

/** Pure: does a saved view match the current active filters? (empty == default) */
export function viewIsActive(
  view: SavedView,
  filters: Record<string, string>,
): boolean {
  const keys = new Set([...Object.keys(view.filters), ...Object.keys(filters)]);
  for (const key of keys) {
    const a = view.filters[key] ?? '';
    const b = filters[key] ?? '';
    if (a !== b) return false;
  }
  return true;
}
