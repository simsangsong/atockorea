/**
 * Build a single self-contained review page for the guide films.
 *
 * The owner watches on a phone, and an Artifact page is served under a strict
 * CSP that blocks every external host — so the videos are inlined as data URIs
 * rather than linked. `.out/web/*.mp4` are the compressed cuts (608×1080, CRF
 * 30), which keeps four films under ~6MB of base64 while staying legible; the
 * masters in `.out/` stay untouched for delivery.
 *
 * The page deliberately wears the FILMS' own design system — warm near-black,
 * the single gold accent, mono micro-labels in the corners — because it is the
 * screening room for those films and a second visual identity would just be
 * noise between the owner and the thing being reviewed.
 *
 * Usage: node scripts/scene-video/make-review-page.mjs [out.html]
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const WEB = path.join(ROOT, 'scripts/scene-video/.out/web');
const OUT = path.resolve(ROOT, process.argv[2] ?? 'scripts/scene-video/.out/review.html');

const FILMS = [
  { film: 'join', locale: 'en', file: 'app-guide-join.mp4', label: 'Join tour', sub: 'English' },
  { film: 'join', locale: 'ko', file: 'app-guide-join.ko.mp4', label: 'Join tour', sub: '한국어' },
  { film: 'private', locale: 'en', file: 'app-guide-private.mp4', label: 'Private tour', sub: 'English' },
  { film: 'private', locale: 'ko', file: 'app-guide-private.ko.mp4', label: 'Private tour', sub: '한국어' },
];

function seconds(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=nw=1:nk=1', file], { stdio: ['ignore', 'pipe', 'pipe'] });
  return Math.round(Number.parseFloat(r.stdout?.toString().trim() ?? '0'));
}

const clips = FILMS.map((f) => {
  const abs = path.join(WEB, f.file);
  if (!fs.existsSync(abs)) throw new Error(`missing web cut: ${f.file} — run the ffmpeg compress step first`);
  const bytes = fs.statSync(abs).size;
  return {
    ...f,
    id: `${f.film}-${f.locale}`,
    secs: seconds(abs),
    mb: (bytes / 1024 / 1024).toFixed(1),
    uri: `data:video/mp4;base64,${fs.readFileSync(abs).toString('base64')}`,
  };
});

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

const html = `<title>ATOC Korea — app guide films</title>
<style>
  :root{
    /* Straight from the films' own ink theme (scripts/scene-video/design.mjs). */
    --ground:#0d0e11; --surface:#171a20; --ink:#f3f5f8; --ink-soft:#9aa3b0;
    --accent:#c9a227; --accent-soft:rgba(201,162,39,.14); --hairline:#242832;
    --display:'Segoe UI Variable Display','Segoe UI',-apple-system,BlinkMacSystemFont,system-ui,sans-serif;
    --mono:'Cascadia Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  }
  @media (prefers-color-scheme: light){
    :root{
      --ground:#ffffff; --surface:#f5f6f8; --ink:#0f1216; --ink-soft:#5b636e;
      /* Gold has to darken to stay legible on white; the hue is the brand, the
         value is whatever the ground demands. */
      --accent:#8a6a12; --accent-soft:rgba(138,106,18,.10); --hairline:#e3e6ea;
    }
  }
  :root[data-theme="light"]{
    --ground:#ffffff; --surface:#f5f6f8; --ink:#0f1216; --ink-soft:#5b636e;
    --accent:#8a6a12; --accent-soft:rgba(138,106,18,.10); --hairline:#e3e6ea;
  }
  :root[data-theme="dark"]{
    --ground:#0d0e11; --surface:#171a20; --ink:#f3f5f8; --ink-soft:#9aa3b0;
    --accent:#c9a227; --accent-soft:rgba(201,162,39,.14); --hairline:#242832;
  }

  body{background:var(--ground);color:var(--ink);font-family:var(--display);
       -webkit-font-smoothing:antialiased;line-height:1.5}
  .wrap{max-width:640px;margin:0 auto;padding:20px 18px 56px;
        display:flex;flex-direction:column;gap:22px}

  /* The films label their four corners in mono; the page keeps the habit. */
  .rail{display:flex;justify-content:space-between;gap:12px;
        font-family:var(--mono);font-size:11px;letter-spacing:.16em;
        text-transform:uppercase;color:var(--ink-soft)}

  h1{font-size:clamp(26px,7vw,36px);line-height:1.15;font-weight:700;
     letter-spacing:-.02em;text-wrap:balance;margin:0}
  .lede{color:var(--ink-soft);font-size:15px;max-width:56ch;margin:0}

  .stage{background:var(--surface);border:1px solid var(--hairline);
         border-radius:16px;overflow:hidden}
  video{display:block;width:100%;height:auto;max-height:74svh;background:#000;
        object-fit:contain}
  video[hidden]{display:none}

  .picker{display:flex;flex-direction:column;gap:10px}
  .row{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
  .row > .key{font-family:var(--mono);font-size:11px;letter-spacing:.16em;
              text-transform:uppercase;color:var(--ink-soft);min-width:74px}
  .chips{display:flex;gap:8px;flex-wrap:wrap}
  button.chip{font:inherit;font-size:14px;font-weight:600;color:var(--ink);
    background:var(--surface);border:1.5px solid var(--hairline);
    border-radius:999px;padding:9px 16px;min-height:44px;cursor:pointer}
  button.chip[aria-pressed="true"]{border-color:var(--accent);color:var(--accent);
    background:var(--accent-soft)}
  button.chip:focus-visible{outline:2px solid var(--accent);outline-offset:2px}

  .meta{font-family:var(--mono);font-size:11px;letter-spacing:.14em;
        text-transform:uppercase;color:var(--ink-soft);
        display:flex;gap:14px;flex-wrap:wrap;font-variant-numeric:tabular-nums}

  .notes{display:flex;flex-direction:column;gap:14px;
         border-top:1px solid var(--hairline);padding-top:22px}
  h2{font-size:13px;font-family:var(--mono);letter-spacing:.16em;
     text-transform:uppercase;color:var(--ink-soft);font-weight:500;margin:0}
  ul{margin:0;padding-left:1.1em;display:flex;flex-direction:column;gap:9px}
  li{font-size:15px}
  li b{font-weight:650}
  .open{border-left:2px solid var(--accent);padding-left:14px;
        display:flex;flex-direction:column;gap:6px}
  .open p{margin:0;font-size:15px}
  .open .q{font-weight:650}
  @media (prefers-reduced-motion: reduce){*{animation:none!important;transition:none!important}}
</style>

<div class="wrap">
  <div class="rail"><span>ATOC Korea · app guide</span><span>2026-07-30 · v5</span></div>

  <header style="display:flex;flex-direction:column;gap:10px">
    <h1>Two guide films, ten languages</h1>
    <p class="lede">Information first: drawn scenes teach each feature one point at a time, and the film opens and closes on a single map of the whole app. Real screens appear twice, as proof.</p>
  </header>

  <div class="stage">
    ${clips.map((c, i) => `<video id="v-${c.id}" src="${c.uri}" controls playsinline preload="metadata"${i === 0 ? '' : ' hidden'}></video>`).join('\n    ')}
  </div>

  <div class="picker">
    <div class="row">
      <span class="key">Film</span>
      <div class="chips" id="film-chips">
        <button class="chip" type="button" data-film="join" aria-pressed="true">Join tour</button>
        <button class="chip" type="button" data-film="private" aria-pressed="false">Private tour</button>
      </div>
    </div>
    <div class="row">
      <span class="key">Reading</span>
      <div class="chips" id="locale-chips">
        <button class="chip" type="button" data-locale="en" aria-pressed="true">English only</button>
        <button class="chip" type="button" data-locale="ko" aria-pressed="false">+ 한국어</button>
      </div>
    </div>
    <p class="meta" id="meta"></p>
  </div>

  <div class="notes">
    <h2>What changed in this cut (v5)</h2>
    <ul>
      <li><b>Drawn scenes carry the teaching.</b> A phone silhouette holding one element, a three-step flow, a chat round-trip — each scene is shaped like the information it carries. No more full app screens flying past.</li>
      <li><b>The map is the skeleton.</b> The film opens with the app's five features connecting to one phone, and closes with the same map fully lit — the last frame is the whole app on one card.</li>
      <li><b>Real screens appear twice, as proof.</b> The arrival card you will actually receive, and the SOS screen — both as element crops, nothing else.</li>
      <li><b>One point per scene, at most three new pieces of information.</b> Diagram pieces arrive one at a time because their order is the explanation.</li>
    </ul>

    <h2>Waiting on you</h2>
    <div class="open">
      <p class="q">Will ops actually send the join-tour bulk invite?</p>
      <p>The seat picker now has a door inside the room, but nothing upstream has ever used it — zero claim links issued, zero seats assigned. If yes, the seat short-form gets made. Neither film mentions seats, so both ship either way.</p>
    </div>
  </div>

  <div class="rail"><span>1080×1920 masters · compressed here for phone</span><span>9:16</span></div>
</div>

<script>
  const CLIPS = ${JSON.stringify(clips.map(({ id, film, locale, label, sub, secs, mb }) => ({ id, film, locale, label, sub, secs, mb })))};
  const mmss = (s) => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  let film = 'join', locale = 'en';

  function show() {
    const want = film + '-' + locale;
    for (const c of CLIPS) {
      const el = document.getElementById('v-' + c.id);
      const on = c.id === want;
      if (!on && !el.paused) el.pause();
      el.hidden = !on;
    }
    for (const b of document.querySelectorAll('[data-film]')) {
      b.setAttribute('aria-pressed', String(b.dataset.film === film));
    }
    for (const b of document.querySelectorAll('[data-locale]')) {
      b.setAttribute('aria-pressed', String(b.dataset.locale === locale));
    }
    const c = CLIPS.find((x) => x.id === want);
    document.getElementById('meta').textContent =
      c ? [c.label, c.sub, mmss(c.secs), c.mb + 'MB'].join('  ·  ') : '';
  }

  document.getElementById('film-chips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-film]');
    if (b) { film = b.dataset.film; show(); }
  });
  document.getElementById('locale-chips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-locale]');
    if (b) { locale = b.dataset.locale; show(); }
  });
  show();
</script>`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);
console.log(`  ${path.relative(ROOT, OUT)}  ${(fs.statSync(OUT).size / 1024 / 1024).toFixed(1)}MB`);
for (const c of clips) console.log(`    ${c.id.padEnd(14)} ${mmss(c.secs)}  ${c.mb}MB`);
