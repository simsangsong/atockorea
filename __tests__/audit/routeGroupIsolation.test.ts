/**
 * 🔴 X13 standing gate — the tour app must not re-inherit the marketing shell.
 *
 * The split is worth 316 KB on the guest's first paint, and it is held together
 * by nothing but the absence of a few imports. One `import { useTranslations }
 * from '@/lib/i18n'` anywhere in `app/(app)/**` or the components it reaches
 * pulls `messages/en.json` (169 KB of marketing copy) straight back into the
 * bundle — and the app would still WORK, so nothing else in the repo would
 * report it. The regression is invisible by construction; only a gate sees it.
 *
 * The scan is transitive on purpose. A direct-import check would pass while a
 * component three levels down does the importing, which is how this class of
 * regression actually arrives.
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..', '..');
const APP_GROUP = path.join(ROOT, 'app', '(app)');

/**
 * What the tour app is not allowed to reach.
 *
 * Each entry costs real bytes on a phone at a pickup point:
 *   lib/i18n            → statically imports every `messages/*.json`
 *   lib/currency        → an exchange-rate provider for an app with no prices
 *   lib/auth-session    → supabase-js, for guests who enter by signed token
 *   analytics / widgets → chunks that ship even where they refuse to render
 */
const FORBIDDEN: ReadonlyArray<{ prefix: string; why: string }> = [
  { prefix: 'lib/i18n', why: 'statically imports every messages/*.json (169 KB of marketing copy)' },
  { prefix: 'lib/currency', why: 'exchange-rate provider; a tour room shows no prices' },
  { prefix: 'lib/auth-session', why: 'supabase-js session; guests enter by signed invite token' },
  { prefix: 'components/analytics/', why: 'marketing page-view tracking' },
  { prefix: 'components/GlobalAiAssistant', why: 'site chatbot shell — refuses to render here, still shipped' },
  { prefix: 'components/welcome/', why: 'welcome-coupon popup — marketing surface' },
];

function resolveSpec(spec: string, from: string): string | null {
  const base = spec.startsWith('@/')
    ? path.join(ROOT, spec.slice(2))
    : spec.startsWith('.')
      ? path.resolve(path.dirname(from), spec)
      : null;
  if (!base) return null;
  for (const ext of ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx']) {
    const candidate = base + ext;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function relative(file: string): string {
  return path.relative(ROOT, file).split(path.sep).join('/');
}

interface ScanResult {
  modules: number;
  violations: Array<{ target: string; why: string; chain: string }>;
}

function scanFrom(entryDir: string): ScanResult {
  const seen = new Set<string>();
  const violations: ScanResult['violations'] = [];
  const importRe = /(?:^|\n)\s*import\s[^;]*?from\s*['"]([^'"]+)['"]/g;

  const walk = (file: string, chain: string[]) => {
    if (seen.has(file)) return;
    seen.add(file);
    let source: string;
    try {
      source = fs.readFileSync(file, 'utf8');
    } catch {
      return;
    }
    for (const match of source.matchAll(importRe)) {
      const spec = match[1];
      if (spec.startsWith('@/')) {
        const target = spec.slice(2);
        const hit = FORBIDDEN.find((f) => target === f.prefix || target.startsWith(f.prefix));
        if (hit && !violations.some((v) => v.target === target)) {
          violations.push({
            target,
            why: hit.why,
            chain: [...chain, file].map(relative).join(' -> '),
          });
        }
      }
      const resolved = resolveSpec(spec, file);
      if (resolved && !resolved.includes('node_modules')) walk(resolved, [...chain, file]);
    }
  };

  const entries = fs.readdirSync(entryDir, { recursive: true }) as string[];
  for (const entry of entries) {
    const file = path.join(entryDir, String(entry));
    if (!/\.(tsx?|jsx?)$/.test(file)) continue;
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) continue;
    walk(file, []);
  }
  return { modules: seen.size, violations };
}

describe('the scanner actually walked the tour app', () => {
  it('finds the (app) route group and a non-trivial module graph', () => {
    // A renamed group would otherwise make every assertion below vacuously pass.
    expect(fs.existsSync(APP_GROUP)).toBe(true);
    expect(scanFrom(APP_GROUP).modules).toBeGreaterThan(100);
  });

  it('detects a violation when one exists (synthetic)', () => {
    // The scanner is only worth anything if it can fail. Prove it against a
    // fixture rather than trusting that zero means clean.
    const tmp = path.join(ROOT, '.tmp-route-group-fixture');
    fs.mkdirSync(tmp, { recursive: true });
    fs.writeFileSync(path.join(tmp, 'page.tsx'), "import { useI18n } from '@/lib/i18n';\n");
    try {
      const result = scanFrom(tmp);
      expect(result.violations.map((v) => v.target)).toContain('lib/i18n');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('follows imports transitively, not just the entry file', () => {
    const tmp = path.join(ROOT, '.tmp-route-group-fixture2');
    fs.mkdirSync(tmp, { recursive: true });
    fs.writeFileSync(path.join(tmp, 'page.tsx'), "import './deep';\nimport x from './deep';\n");
    fs.writeFileSync(path.join(tmp, 'deep.tsx'), "import { useCurrency } from '@/lib/currency';\n");
    try {
      expect(scanFrom(tmp).violations.map((v) => v.target)).toContain('lib/currency');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('🔴 app/(app) does not reach the marketing shell', () => {
  const result = scanFrom(APP_GROUP);

  it('has no forbidden import anywhere in its module graph', () => {
    const report = result.violations
      .map((v) => `\n  ${v.target} — ${v.why}\n    ${v.chain}`)
      .join('');
    expect(report).toBe('');
  });
});

describe('🔴 there is exactly one root layout per group, and none at app/', () => {
  it('app/layout.tsx does not exist', () => {
    // Next resolves a root `app/layout.tsx` for BOTH groups, which would
    // silently restore the marketing providers over the tour app while every
    // test above still passed.
    expect(fs.existsSync(path.join(ROOT, 'app', 'layout.tsx'))).toBe(false);
  });

  it('both groups have their own root layout with an <html> element', () => {
    for (const group of ['(app)', '(marketing)']) {
      const file = path.join(ROOT, 'app', group, 'layout.tsx');
      expect(fs.existsSync(file)).toBe(true);
      const source = fs.readFileSync(file, 'utf8');
      expect(source).toMatch(/<html\b/);
      expect(source).toMatch(/<body\b/);
    }
  });

  it('no page file sits outside a route group', () => {
    // A page at app/foo/page.tsx would have no root layout at all.
    const strays: string[] = [];
    for (const entry of fs.readdirSync(path.join(ROOT, 'app'), { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('(') || entry.name === 'api') continue;
      const dir = path.join(ROOT, 'app', entry.name);
      const found = (fs.readdirSync(dir, { recursive: true }) as string[]).filter((f) =>
        /(^|[\\/])page\.tsx?$/.test(String(f)),
      );
      if (found.length) strays.push(`${entry.name}: ${found.join(', ')}`);
    }
    expect(strays).toEqual([]);
  });
});

describe('the tour app keeps what it actually needs', () => {
  const raw = fs.readFileSync(path.join(APP_GROUP, 'layout.tsx'), 'utf8');
  /** Comments explain the rules — only code can break them. */
  const layout = raw
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

  /**
   * `globals.css` writes `font-family: …, var(--font-inter), …`. An undeclared
   * custom property inside `var()` with no fallback invalidates the WHOLE
   * declaration at computed-value time — the stack does not degrade, it
   * vanishes. This repo shipped exactly that once (`--tr-on-accent` undeclared
   * → colour inherited → black text on dark green), so it is pinned here.
   */
  it('still declares --font-inter', () => {
    expect(layout).toMatch(/variable:\s*['"]--font-inter['"]/);
  });

  it('still loads Pretendard and the deferred CJK faces', () => {
    // Korean and Japanese guests are a large share of this app; dropping the
    // webfonts would be a visible downgrade, which is not what X13 buys.
    expect(layout).toMatch(/pretendard/i);
    expect(layout).toMatch(/DeferredCjkFontsCss/);
  });

  it('still wraps children in an ErrorBoundary', () => {
    // A crash here is a guest stranded mid-tour.
    expect(layout).toMatch(/<ErrorBoundary>/);
  });

  it('does not reintroduce the z-index wrapper R8 found', () => {
    // `relative z-[1]` on a parent creates a stacking context that traps the
    // room's fixed overlays (z-[71]) under its chrome (z-30).
    expect(layout).not.toMatch(/z-\[1\]/);
  });

  /**
   * 🔴 The pair that has to stay a pair.
   *
   * `body::before` is a POSITIONED pseudo-element (`fixed`, z-index 0), so it
   * paints above normal-flow content. The marketing root lifts its children
   * over it with a `relative z-[1]` wrapper. This layout has no wrapper, so it
   * must instead be true that the mesh is switched off — otherwise the entry
   * screen renders as a blank gradient with one washed-out button while
   * `getComputedStyle` still reports every element as visible. That combination
   * (DOM correct, paint wrong) is invisible to every other test in this repo;
   * it took a screenshot to find, so it gets an assertion.
   */
  it('suppresses body::before for the tour app, since nothing lifts content over it', () => {
    const css = fs.readFileSync(path.join(ROOT, 'app', 'globals.css'), 'utf8');
    const rule = css.match(/body\.lang-tour-app::before\s*\{[^}]*\}/)?.[0];
    expect(rule).toBeDefined();
    expect(rule).toMatch(/display:\s*none/);
    // And the class that rule keys off has to actually be on the body.
    expect(layout).toMatch(/lang-tour-app/);
  });
});
