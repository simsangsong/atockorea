/**
 * @jest-environment node
 *
 * A2 (feature audit F5) — the day plan's `version` is a guard, not a label.
 *
 * The column was always there. `PUT /plan` incremented it on every write and
 * the guide console printed it ("손님 희망 일정 v3"). Nothing read it to decide
 * anything, so two writers who both held v5 both wrote v6 and the later one
 * won by arriving last — both told 200. Measured with
 * `scripts/qa-plan-concurrency.ts`: two writes from one snapshot, first edit
 * silently gone.
 *
 * That is this track's dominant defect one layer down again: not a missing
 * module, not a missing caller, but a FIELD that is written, shipped, and
 * displayed while nobody consumes it — the same shape as `participants` in the
 * guide console (`declaredButUnread.test.ts`).
 *
 * So the guard is three-sided and all three sides are asserted here. A check
 * only the server performs is a check no client trips; a token only the clients
 * send is a token nothing enforces.
 *
 * Mutation check: delete the `plan_stale` branch, or drop `version` from either
 * client's PUT body, and this suite fails.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8');

const ROUTE = 'app/api/tour-rooms/[bookingId]/plan/route.ts';
const GUEST_EDITOR = 'components/tour-mode/plan/PlanEditorClient.tsx';
const GUIDE_PANEL = 'components/tour-mode/guide/GuidePlanPanel.tsx';

/** Code only — a rule that cannot tell code from prose fails on its own docs. */
function codeOf(source: string): string {
  return source
    .split('\n')
    .filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line))
    .join('\n');
}

describe('A2 — the server refuses a write composed from a stale plan', () => {
  const route = codeOf(read(ROUTE));

  it('compares the claimed version against the row it just read', () => {
    expect(route).toMatch(/claimedVersion/);
    expect(route).toMatch(/currentVersion/);
    expect(route).toMatch(/claimedVersion !== null && claimedVersion !== currentVersion/);
  });

  it('🔴 answers 409 with a distinct code, not the lock code', () => {
    // `plan_locked` is permanent (the guide confirmed); `plan_stale` means
    // "someone saved first". A client that cannot tell them apart either goes
    // read-only for a transient conflict or keeps retrying a permanent one.
    expect(route).toMatch(/error: 'plan_stale'/);
    expect(route).toMatch(/error: 'plan_locked'/);
  });

  it('🔴 hands back the current plan so the client can resync in one trip', () => {
    const at = route.indexOf("error: 'plan_stale'");
    expect(at).toBeGreaterThan(-1);
    const block = route.slice(at, at + 400);
    expect(block).toMatch(/day_plan: existing/);
    expect(block).toMatch(/status: 409/);
  });

  it('checks before it writes', () => {
    expect(route.indexOf("error: 'plan_stale'")).toBeLessThan(route.indexOf('.upsert('));
  });

  it('🔴 the version it stores is the one it just compared against', () => {
    // Re-deriving it from `existing` a second time would let the two drift, and
    // the guard would be comparing against a number the write does not use.
    expect(route).toMatch(/version: currentVersion \+ 1/);
  });

  it('stays optional, so a stale bundle degrades instead of failing shut', () => {
    // Mandatory would turn a mid-deploy old client into "nothing saves at all",
    // which is worse than the unguarded behaviour this replaces.
    expect(route).toMatch(/typeof body\.version === 'number'/);
  });
});

describe('A2 — the ledger applies a transition to the row it read', () => {
  const extras = codeOf(read('app/api/tour-rooms/[bookingId]/extras/route.ts'));

  it('🔴 the status update is conditional on the status the decision used', () => {
    // `settle` starts from logged OR confirmed and `confirm` starts from
    // logged, so a guide's 수취완료 and a guest's 확인 begin at the same status
    // and both pass the transition rules. Unguarded, a `confirmed` lands on top
    // of a `settled` and erases a cash receipt.
    expect(extras).toMatch(/const priorStatus = \(existing as ExtraRow\)\.status/);
    const at = extras.indexOf("from('tour_room_extras')\n      .update(");
    expect(at).toBeGreaterThan(-1);
    expect(extras.slice(at, at + 500)).toMatch(/\.eq\('status', priorStatus\)/);
  });

  it('🔴 a lost race is a 409, not a silent no-op', () => {
    // `.maybeSingle()` returns null instead of throwing when the guard filters
    // the row out, so the branch has to exist or the route would answer 200
    // with no row and the capsule would still be written.
    expect(extras).toMatch(/\.maybeSingle\(\);\s*\n\s*if \(updateError\) throw updateError;\s*\n\s*if \(!updated\)/);
    expect(extras).toMatch(/error: 'extra_stale'/);
  });

  it('refuses before the audit capsule is written', () => {
    // Scoped to PATCH: `insertExtraCapsule` is also called from POST, earlier
    // in the file, and comparing against that occurrence measured nothing.
    const patch = extras.slice(extras.indexOf('export async function PATCH'));
    expect(patch).toContain("error: 'extra_stale'");
    expect(patch.indexOf("error: 'extra_stale'")).toBeLessThan(patch.indexOf('insertExtraCapsule('));
  });
});

describe('A2 — both writers actually send the token', () => {
  /**
   * Counted rather than sliced. A window around `method: 'PUT'` cannot see a
   * body assembled on the lines above it — the first version of this rule
   * looked there, missed the guest editor's debounced save, and reported a
   * defect that was not one. Counting asks the invariant directly: as many
   * version-carrying writes as there are writes.
   */
  const count = (source: string, pattern: RegExp) => (codeOf(source).match(pattern) ?? []).length;
  const PUT_SITES = /method: 'PUT'/g;

  it('🔴 every guest-editor write carries a version', () => {
    const source = read(GUEST_EDITOR);
    const writes = count(source, PUT_SITES);
    const versioned = count(source, /version: latestVersion\.current/g);
    // Non-vacuous: three distinct write paths today (debounced save, unload
    // beacon, delegate). A refactor that collapses them says so here rather
    // than letting the sweep quietly measure less.
    expect(writes).toBeGreaterThanOrEqual(3);
    expect(versioned).toBeGreaterThanOrEqual(writes);
  });

  it('🔴 the guest editor reads the version from a ref, not from render state', () => {
    // `save` depends on `plan?.viewer.can_edit`, not on `plan`, so the object
    // in its closure can be several saves old. Reading the version there would
    // manufacture conflicts against ourselves.
    const source = read(GUEST_EDITOR);
    expect(source).toMatch(/const latestVersion = useRef<number \| null>\(null\)/);
    expect(source).toMatch(/latestVersion\.current = version/);
  });

  it('🔴 every guide-panel write carries a version', () => {
    const source = read(GUIDE_PANEL);
    const writes = count(source, PUT_SITES);
    const versioned = count(source, /version: data\.day_plan\.version/g);
    expect(writes).toBeGreaterThanOrEqual(1);
    expect(versioned).toBeGreaterThanOrEqual(writes);
  });

  it('🔴 the guide panel resyncs on a conflict and does not re-send', () => {
    // A 확정 is consent to specific content. Retrying it confirms something the
    // guide never saw.
    const panel = codeOf(read(GUIDE_PANEL));
    const at = panel.indexOf("body.error === 'plan_stale'");
    expect(at).toBeGreaterThan(-1);
    const block = panel.slice(at, at + 700);
    expect(block).toMatch(/setStops\(/);
    expect(block).toMatch(/setError\(/);
    expect(block).toMatch(/return false/);
    expect(block).not.toMatch(/api\('\/plan'/);
  });
});
