// Shared analytics event/step matching. Extracted from the funnel route so the
// experiments route (and any future analytics consumer) applies the SAME
// step-filter semantics instead of approximating with an event-name-only match
// (D-15: experiments dropped the conversion filter via `void conversionFilter`).

export type MatchableEvent = {
  event_name: string;
  payload?: Record<string, unknown> | null;
  page_path?: string | null;
  locale?: string | null;
  device_class?: string | null;
};

export type StepFilter = Record<string, unknown> | null | undefined;

export type MatchableStep = {
  event_name: string;
  label?: string;
  filter?: StepFilter;
};

/**
 * Does the event satisfy a step's filter? `event_name` is NOT checked here — use
 * {@link eventMatchesStep} for the full match. Empty/absent filter → true.
 *
 * Filter keys are interpreted as:
 *  - `page_path`        exact page-path match
 *  - `page_path_like`   SQL-style LIKE (`%`→`.*`, `_`→`.`) anchored match
 *  - `locale`           exact locale match (context column)
 *  - `device_class`     exact device-class match (context column)
 *  - anything else      payload key/value equality
 * Filter entries whose expected value is null/undefined are skipped.
 */
export function eventMatchesFilter(ev: MatchableEvent, filter: StepFilter): boolean {
  if (!filter || typeof filter !== 'object') return true;

  for (const [k, expected] of Object.entries(filter)) {
    if (expected === null || expected === undefined) continue;
    if (k === 'page_path') {
      if (ev.page_path !== expected) return false;
      continue;
    }
    if (k === 'page_path_like') {
      if (!ev.page_path) return false;
      const pattern = String(expected).replace(/%/g, '.*').replace(/_/g, '.');
      const rx = new RegExp(`^${pattern}$`);
      if (!rx.test(ev.page_path)) return false;
      continue;
    }
    if (k === 'locale') {
      if (ev.locale !== expected) return false;
      continue;
    }
    if (k === 'device_class') {
      if (ev.device_class !== expected) return false;
      continue;
    }
    const payload = ev.payload ?? {};
    if ((payload as Record<string, unknown>)[k] !== expected) return false;
  }
  return true;
}

/** Full step match: event name AND filter. */
export function eventMatchesStep(ev: MatchableEvent, step: MatchableStep): boolean {
  if (ev.event_name !== step.event_name) return false;
  return eventMatchesFilter(ev, step.filter);
}
