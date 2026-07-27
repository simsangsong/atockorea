'use client';

/**
 * T-D5 (docs/pwa-ui-theme-design-master-plan-2026-07-27.md) — the skin
 * scenery layer: one caricature landscape per skin, drawn as pure inline SVG
 * (zero network, <45 nodes/scene) and pinned to the bottom of the shell
 * canvas so chat bubbles and cards scroll OVER it — the KakaoTalk wallpaper
 * grammar (숨바꼭질's hills), with real-Korea landmarks the owner picked:
 * 제주 돌하르방·해녀, 서울 남산타워·경복궁·한강대교, 부산 해운대·용궁사·
 * 스카이캡슐 — chubby rounded silhouettes, faces only where cute (돌하르방).
 *
 * Geometry rules (walk-calibrated, 2026-07-27):
 *  - viewBox 720×300, `xMidYMax slice`, wrapper max-w-2xl → never upscales.
 *  - A 390px phone sees x ∈ [165, 555] — every signature motif lives there;
 *    hills/waves extend the full 720 for wider screens.
 *  - On the guest CHAT tab the quick-signal / Smart-Guide / reply stack
 *    covers the band's lower ~220px, so each scene keeps its sky icons
 *    (clouds, birds, tower crown, Sky Capsule, blossoms, main peak) in the
 *    TOP ~75px — the strip that stays visible above the stack. Ground-level
 *    detail (statues, flowers, pagoda) shows on Home/Settings/staff tabs.
 *
 * Color discipline (T-D5/T-D7): every palette is split into
 *   bands   — large fills (hills, sea, roofs). skinContrast.test.ts enforces
 *             ink-3 vs band ≥ 3.5:1 in BOTH themes so timestamps that land
 *             on a band stay readable.
 *   accents — small motifs (clouds, statues, the capsule…). Exempt from the
 *             numeric gate (partial, transient overlap — Kakao precedent)
 *             but kept in the same muted register.
 * Dark themes are night scenes: bands sit a whisper ABOVE canvas luminance
 * (moonlit silhouettes — pure darker-than-canvas fills disappeared on real
 * screens), still clearing the 3.5 gate against the light ink-3.
 *
 * 'contrast' has NO scene on purpose — decoration behind text is exactly
 * what the accessibility skin exists to remove. The cockpit and plan editor
 * never stamp data-tr-skin, so they never render this either.
 */

import type { ReactNode } from 'react';
import type { TourSkin } from '@/hooks/useTourRoomSettings';

export type ScenerySkin = Exclude<TourSkin, 'contrast'>;
type Palette = Record<string, string>;

interface SceneSpec {
  light: Palette;
  dark: Palette;
  /** Keys of the LARGE fills — the ones the contrast test gates. */
  bandKeys: string[];
}

/* ---- palettes (exported for skinContrast.test.ts) ---------------------- */

export const SKIN_SCENERY_SPECS: Record<ScenerySkin, SceneSpec> = {
  classic: {
    light: { ridgeFar: '#d9e2d5', ridgeNear: '#ccd8c7', cloud: '#ffffff', cloudSoft: '#f3f7f2' },
    dark: { ridgeFar: '#1d2321', ridgeNear: '#191e1c', cloud: '#2c3431', cloudSoft: '#262d2a' },
    bandKeys: ['ridgeFar', 'ridgeNear'],
  },
  sky: {
    light: { cloud: '#ffffff', cloudSoft: '#eef5f9', bird: '#5b7186' },
    dark: { cloud: '#1a222a', cloudSoft: '#161d24', bird: '#4a5966' },
    bandKeys: ['cloud', 'cloudSoft'],
  },
  winter: {
    light: { ridgeFar: '#c9d8e7', ridgeNear: '#bccfe1', snow: '#ffffff', flake: '#ffffff', cloud: '#f2f7fb' },
    dark: { ridgeFar: '#192028', ridgeNear: '#141a22', snow: '#2e3b49', flake: '#3b4a59', cloud: '#202832' },
    bandKeys: ['ridgeFar', 'ridgeNear'],
  },
  forest: {
    light: { treeFar: '#d3dbae', treeNear: '#c4cf98', mist: '#eef1dd', trunk: '#a8b478', bird: '#7d8a58' },
    dark: { treeFar: '#1a2016', treeNear: '#161b12', mist: '#1e2419', trunk: '#2a3421', bird: '#48543a' },
    bandKeys: ['treeFar', 'treeNear', 'mist'],
  },
  meadow: {
    light: { hillFar: '#c2dcd0', hillNear: '#b1d2c2', cloud: '#ffffff', flower: '#ffffff', flowerCore: '#e9b95e' },
    dark: { hillFar: '#17201c', hillNear: '#131a17', cloud: '#212b26', flower: '#4a6558', flowerCore: '#6d8a7d' },
    bandKeys: ['hillFar', 'hillNear'],
  },
  jeju: {
    light: {
      mountain: '#e5d2b4',
      sea: '#cfe0d9',
      sand: '#eeddc2',
      cloud: '#ffffff',
      foam: '#ffffff',
      stone: '#c9b8a4',
      stoneShade: '#b7a68f',
      face: '#6f6152',
      suit: '#4a5a66',
      skin: '#f2c9a3',
      tewak: '#e8734f',
      tangerine: '#f0a04a',
      leaf: '#7f9c6e',
    },
    dark: {
      mountain: '#241c14',
      sea: '#1f2019',
      sand: '#211a12',
      cloud: '#322a1f',
      foam: '#3d4a41',
      stone: '#3f352a',
      stoneShade: '#52463a',
      face: '#1a130c',
      suit: '#2e3b46',
      skin: '#c9a37e',
      tewak: '#c47646',
      tangerine: '#d69653',
      leaf: '#5a6a47',
    },
    bandKeys: ['mountain', 'sea', 'sand'],
  },
  seoul: {
    light: {
      palace: '#d5d1e6',
      hill: '#c6c1dd',
      river: '#dcd8ec',
      cloud: '#ffffff',
      tower: '#8b86b0',
      towerBulb: '#a59fc8',
      bridge: '#b0aacd',
      glint: '#ffffff',
      bird: '#8b86b0',
    },
    dark: {
      palace: '#1c1b28',
      hill: '#181724',
      river: '#1b1a2a',
      cloud: '#262534',
      tower: '#575382',
      towerBulb: '#7a75a8',
      bridge: '#454167',
      glint: '#d9b46a',
      bird: '#575382',
    },
    bandKeys: ['palace', 'hill', 'river'],
  },
  busan: {
    light: {
      sea: '#d5e2e4',
      sand: '#f2d7c8',
      headland: '#ecc9b8',
      foam: '#ffffff',
      pagoda: '#c4a9a0',
      pagodaRoof: '#8a7473',
      bridge: '#ffffff',
      rail: '#c9a08e',
      capsule: '#f2b23c',
      capsuleTrim: '#ffffff',
      capsuleWin: '#3e4550',
      gull: '#7f97a2',
      sun: '#f6bd8d',
    },
    dark: {
      sea: '#191e24',
      sand: '#1a1512',
      headland: '#161a20',
      foam: '#35444e',
      pagoda: '#453c38',
      pagodaRoof: '#58504b',
      bridge: '#55636e',
      rail: '#4f403a',
      capsule: '#c9902e',
      capsuleTrim: '#d8ccb8',
      capsuleWin: '#f0c98a',
      gull: '#5f6f79',
      sun: '#d8e2ea',
    },
    bandKeys: ['sea', 'sand', 'headland'],
  },
  blossom: {
    light: {
      hillFar: '#eccfda',
      hillNear: '#e4bfce',
      branch: '#a8697d',
      bloom: '#ffffff',
      bloomSoft: '#f6d3de',
      petal: '#f2c4d3',
    },
    dark: {
      hillFar: '#211a1f',
      hillNear: '#1c1619',
      branch: '#533c48',
      bloom: '#a37b8a',
      bloomSoft: '#8a6675',
      petal: '#7a5a68',
    },
    bandKeys: ['hillFar', 'hillNear'],
  },
};

/* ---- shared shapes ------------------------------------------------------ */

function Cloud({ x, y, s = 1, fill }: { x: number; y: number; s?: number; fill: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill={fill}>
      <ellipse cx="0" cy="0" rx="26" ry="13" />
      <ellipse cx="-20" cy="5" rx="17" ry="9" />
      <ellipse cx="20" cy="5" rx="19" ry="10" />
    </g>
  );
}

function Bird({ x, y, s = 1, stroke }: { x: number; y: number; s?: number; stroke: string }) {
  return (
    <path
      d={`M${x - 8 * s} ${y} q ${4 * s} ${-5 * s} ${8 * s} 0 q ${4 * s} ${-5 * s} ${8 * s} 0`}
      fill="none"
      stroke={stroke}
      strokeWidth={2 * s}
      strokeLinecap="round"
    />
  );
}

/**
 * 돌하르방 v2 — reference round (owner-supplied flat-vector refs, 2026-07-27).
 * The real statue's signature marks, caricatured: 벙거지 hat with a proper
 * BRIM ledge, huge bulging eyes (왕방울 눈 — the icon, not dots), a broad
 * blunt nose, and the two hands STAGGERED on the belly (one above the other,
 * how every real 하르방 stands). Porous-basalt dots finish the read.
 */
function Dolharubang({ x, y, s = 1, c }: { x: number; y: number; s?: number; c: Palette }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {/* body + head (one tapered mass, like the carved stone) */}
      <path d="M-14 44 Q-17 8 -10 -5 Q-6 -15 0 -15 Q6 -15 10 -5 Q17 8 14 44 Z" fill={c.stone} />
      {/* 벙거지 — dome + wide brim ledge */}
      <path d="M-11 -13 Q0 -27 11 -13 Z" fill={c.stoneShade} />
      <ellipse cx="0" cy="-12" rx="13.5" ry="4.8" fill={c.stoneShade} />
      {/* 왕방울 눈 — big protruding ovals with a glint */}
      <ellipse cx="-5" cy="-4.5" rx="2.9" ry="3.5" fill={c.face} />
      <ellipse cx="5" cy="-4.5" rx="2.9" ry="3.5" fill={c.face} />
      <circle cx="-4.1" cy="-5.7" r="0.9" fill={c.stone} />
      <circle cx="5.9" cy="-5.7" r="0.9" fill={c.stone} />
      {/* broad blunt nose (shaded so it reads carved) */}
      <path d="M-2 -3.5 Q-2.8 3 0 4.8 Q2.8 3 2 -3.5 Q0 -5.2 -2 -3.5 Z" fill={c.stoneShade} />
      {/* soft mouth */}
      <path d="M-2.6 8.8 Q0 10.8 2.6 8.8" fill="none" stroke={c.face} strokeWidth="1.5" strokeLinecap="round" />
      {/* hands on the belly — STAGGERED, right above left */}
      <path d="M-11 14 Q-1 19 11 15" fill="none" stroke={c.stoneShade} strokeWidth="3.6" strokeLinecap="round" />
      <path d="M-11 25 Q1 30 11 26" fill="none" stroke={c.stoneShade} strokeWidth="3.6" strokeLinecap="round" />
      {/* porous basalt dots */}
      <circle cx="-7.5" cy="2" r="1" fill={c.stoneShade} opacity="0.55" />
      <circle cx="8" cy="7" r="1" fill={c.stoneShade} opacity="0.55" />
      <circle cx="-6" cy="34" r="1.1" fill={c.stoneShade} opacity="0.55" />
      <circle cx="6.5" cy="38" r="1" fill={c.stoneShade} opacity="0.55" />
    </g>
  );
}

/* ---- scenes (720×300 · signature icons in the top ~75px) ---------------- */

function MountainsScene(c: Palette): ReactNode {
  return (
    <>
      {/* one grand center dome — its crown stays visible above the chat stack */}
      <path
        d="M0 300 V210 Q80 160 160 190 Q250 218 300 150 Q345 60 395 60 Q445 60 486 152 Q540 224 630 194 Q680 178 720 186 V300 Z"
        fill={c.ridgeFar}
      />
      <path
        d="M0 300 V262 Q100 218 220 244 Q330 268 440 238 Q550 210 650 246 Q690 260 720 254 V300 Z"
        fill={c.ridgeNear}
      />
      <Cloud x={250} y={52} s={0.85} fill={c.cloud} />
      <Cloud x={505} y={38} s={0.7} fill={c.cloudSoft} />
      <Cloud x={615} y={90} s={0.5} fill={c.cloudSoft} />
    </>
  );
}

function CloudsScene(c: Palette): ReactNode {
  return (
    <>
      <Cloud x={200} y={58} s={1.2} fill={c.cloud} />
      <Cloud x={392} y={44} s={1.55} fill={c.cloud} />
      <Cloud x={556} y={90} s={0.95} fill={c.cloudSoft} />
      <Cloud x={120} y={128} s={0.7} fill={c.cloudSoft} />
      <Cloud x={648} y={156} s={0.6} fill={c.cloudSoft} />
      <Cloud x={300} y={196} s={0.85} fill={c.cloudSoft} />
      <Cloud x={520} y={242} s={0.7} fill={c.cloud} />
      <Bird x={330} y={26} stroke={c.bird} />
      <Bird x={362} y={20} s={0.75} stroke={c.bird} />
    </>
  );
}

function WinterScene(c: Palette): ReactNode {
  return (
    <>
      <path
        d="M0 300 V232 L110 172 L200 246 L286 60 L390 250 L470 118 L560 248 L640 178 L720 228 V300 Z"
        fill={c.ridgeFar}
      />
      {/* snow caps on the tall peaks */}
      <path d="M286 60 L316 92 Q301 100 286 95 Q271 100 256 92 Z" fill={c.snow} />
      <path d="M470 118 L494 134 Q482 140 470 135 Q458 140 446 134 Z" fill={c.snow} />
      <path d="M110 172 L132 186 Q121 191 110 187 Q99 191 88 186 Z" fill={c.snow} />
      <path
        d="M0 300 V276 Q110 240 240 262 Q360 282 480 258 Q600 236 720 268 V300 Z"
        fill={c.ridgeNear}
      />
      <Cloud x={180} y={44} s={0.7} fill={c.cloud} />
      <Cloud x={580} y={54} s={0.85} fill={c.cloud} />
      {[
        [240, 46, 2.4],
        [420, 64, 2],
        [660, 40, 2.4],
        [150, 140, 2.2],
        [350, 150, 2.6],
        [520, 170, 2],
        [610, 120, 2.4],
      ].map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={c.flake} />
      ))}
    </>
  );
}

function ForestScene(c: Palette): ReactNode {
  return (
    <>
      <Cloud x={300} y={44} s={0.8} fill={c.mist} />
      <Cloud x={520} y={32} s={0.6} fill={c.mist} />
      <Bird x={420} y={62} stroke={c.bird} />
      <Bird x={452} y={52} s={0.75} stroke={c.bird} />
      <g fill={c.treeFar}>
        {[
          [40, 218, 34],
          [116, 208, 40],
          [196, 220, 32],
          [268, 206, 42],
          [352, 218, 34],
          [430, 204, 44],
          [516, 218, 34],
          [592, 206, 42],
          [672, 218, 36],
        ].map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} />
        ))}
        <rect x="0" y="216" width="720" height="84" />
      </g>
      <rect x="0" y="220" width="720" height="12" rx="6" fill={c.mist} opacity="0.75" />
      <g fill={c.treeNear}>
        {[
          [80, 268, 40],
          [190, 260, 48],
          [318, 270, 42],
          [438, 258, 52],
          [566, 268, 44],
          [672, 260, 48],
        ].map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} />
        ))}
        <rect x="0" y="266" width="720" height="34" />
      </g>
      <path d="M438 300 V284 M318 300 V288" stroke={c.trunk} strokeWidth="5" strokeLinecap="round" />
    </>
  );
}

function MeadowScene(c: Palette): ReactNode {
  return (
    <>
      <path d="M0 300 V236 Q180 172 380 214 Q560 252 720 210 V300 Z" fill={c.hillFar} />
      <path d="M0 300 V282 Q170 246 360 268 Q540 292 720 274 V300 Z" fill={c.hillNear} />
      <Cloud x={286} y={50} s={0.95} fill={c.cloud} />
      <Cloud x={520} y={74} s={0.6} fill={c.cloud} />
      <Cloud x={160} y={104} s={0.5} fill={c.cloud} />
      {[
        [210, 284],
        [330, 292],
        [452, 286],
        [560, 294],
      ].map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="4.5" fill={c.flower} />
          <circle cx={x} cy={y} r="1.8" fill={c.flowerCore} />
        </g>
      ))}
    </>
  );
}

function JejuScene(c: Palette): ReactNode {
  return (
    <>
      {/* 한라산 — shield-volcano profile (wide base, CONCAVE slopes, flat
          crown): the first straight-sided cut read as a pyramid on the home
          canvas. The crown still owns the chat strip. */}
      <path
        d="M48 300 Q180 284 258 196 Q306 128 322 78 Q336 52 360 52 Q384 52 398 78 Q414 128 462 196 Q540 284 672 300 Z"
        fill={c.mountain}
      />
      <Cloud x={288} y={34} s={0.8} fill={c.cloud} />
      <Cloud x={462} y={62} s={0.55} fill={c.cloud} />
      {/* sea + foam */}
      <rect x="0" y="252" width="720" height="48" fill={c.sea} />
      {[180, 320, 470].map((x, i) => (
        <path
          key={i}
          d={`M${x} 264 q 12 -6 24 0 q 12 6 24 0`}
          fill="none"
          stroke={c.foam}
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.8"
        />
      ))}
      {/* 해녀 v2 — black hood + FACE + round goggles, hugging her 테왁
          (net lines over the orange float = the real thing), fins kicking
          behind with a splash. */}
      <g>
        <path d="M177 247 q6 -5 12 0" fill="none" stroke={c.foam} strokeWidth="2" strokeLinecap="round" opacity="0.9" />
        <path d="M172 253 q5 -4 10 0" fill="none" stroke={c.foam} strokeWidth="1.6" strokeLinecap="round" opacity="0.8" />
        {/* fins up mid-kick */}
        <path d="M186 247 q-9 -1 -12 -8 q9 -1 14 4 Z" fill={c.suit} />
        <path d="M190 251 q-8 1 -12 -4 q7 -2 12 0 Z" fill={c.suit} />
        {/* body hump + hooded head */}
        <ellipse cx="201" cy="249" rx="10" ry="6" fill={c.suit} />
        <circle cx="213" cy="240" r="7.5" fill={c.suit} />
        {/* face inside the hood */}
        <circle cx="215" cy="241" r="4.2" fill={c.skin} />
        {/* round diving goggles + strap over the hood */}
        <circle cx="216.5" cy="239.5" r="2.5" fill="none" stroke={c.foam} strokeWidth="1.5" />
        <path d="M206.5 238 Q212 233.5 219.5 236.5" fill="none" stroke={c.foam} strokeWidth="1.4" strokeLinecap="round" />
        <path d="M214 244.4 q1.6 1.3 3.2 0" fill="none" stroke={c.face} strokeWidth="1.1" strokeLinecap="round" />
        {/* arm wrapped over the float */}
        <path d="M219 245 Q227 246 231.5 250" fill="none" stroke={c.suit} strokeWidth="4" strokeLinecap="round" />
        {/* 테왁 — orange float with its net */}
        <circle cx="237" cy="252" r="7.5" fill={c.tewak} />
        <path d="M230.5 249 Q237 256 243.5 249 M233 258 Q237 252.5 241 258" fill="none" stroke={c.suit} strokeWidth="1.2" strokeLinecap="round" />
        <circle cx="234" cy="249" r="1.6" fill={c.foam} opacity="0.85" />
      </g>
      {/* foreground sand + the stone grandpas (all inside the phone window) */}
      <path d="M330 300 Q500 262 720 282 V300 Z" fill={c.sand} />
      <Dolharubang x={455} y={232} s={1.05} c={c} />
      <Dolharubang x={517} y={244} s={0.8} c={c} />
      {/* tangerines resting on the sand */}
      <g>
        <circle cx={398} cy={283} r="7" fill={c.tangerine} />
        <circle cx={414} cy={290} r="6" fill={c.tangerine} />
        <path d="M394 275 q4 -5 9 -3" fill="none" stroke={c.leaf} strokeWidth="2.5" strokeLinecap="round" />
      </g>
    </>
  );
}

function SeoulScene(c: Palette): ReactNode {
  return (
    <>
      {/* N서울타워 — the bulb itself rides the chat strip, not just the antenna */}
      <path d="M320 300 Q450 160 580 300 Z" fill={c.hill} />
      <g>
        <rect x="446" y="62" width="8" height="104" rx="3.5" fill={c.tower} />
        <ellipse cx="450" cy="54" rx="13" ry="7.5" fill={c.towerBulb} />
        <path d="M450 46 V22" stroke={c.tower} strokeWidth="3" strokeLinecap="round" />
      </g>
      {/* 경복궁 — two-tier hanok roof, left of Namsan */}
      <g fill={c.palace}>
        <path d="M186 232 Q250 212 314 232 L306 232 Q308 246 298 248 L202 248 Q192 246 194 232 Z" />
        <path d="M168 256 Q250 230 332 256 L324 256 Q326 272 314 274 L186 274 Q174 272 176 256 Z" />
        <rect x="192" y="274" width="116" height="26" rx="3" />
      </g>
      {/* 한강 + 한강대교 — reference round: the real bridge is a TIED-ARCH,
          arches rising ABOVE the deck with hangers (the first cut bowed
          under the deck and read as a generic viaduct). */}
      <rect x="0" y="276" width="720" height="24" fill={c.river} />
      <g>
        <rect x="420" y="260" width="300" height="4.5" rx="2.25" fill={c.bridge} />
        <path
          d="M436 262 q 34 -30 68 0 M504 262 q 34 -30 68 0 M572 262 q 34 -30 68 0 M640 262 q 34 -30 68 0"
          fill="none"
          stroke={c.bridge}
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M453 251 V262 M470 247.5 V262 M487 251 V262 M521 251 V262 M538 247.5 V262 M555 251 V262 M589 251 V262 M606 247.5 V262 M623 251 V262 M657 251 V262 M674 247.5 V262 M691 251 V262"
          stroke={c.bridge}
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path d="M436 276 V262 M504 276 V262 M572 276 V262 M640 276 V262 M708 276 V262" stroke={c.bridge} strokeWidth="4" strokeLinecap="round" />
      </g>
      {[478, 540, 602].map((x, i) => (
        <path key={i} d={`M${x} 286 h18`} stroke={c.glint} strokeWidth="2.5" strokeLinecap="round" opacity="0.85" />
      ))}
      <Cloud x={560} y={40} s={0.8} fill={c.cloud} />
      <Cloud x={230} y={72} s={0.55} fill={c.cloud} />
      <Bird x={306} y={48} stroke={c.bird} />
      <Bird x={338} y={38} s={0.8} stroke={c.bird} />
    </>
  );
}

function BusanScene(c: Palette): ReactNode {
  return (
    <>
      {/* sunset sun on the horizon, behind the bridge */}
      <path d="M252 252 a 26 26 0 0 1 52 0 Z" fill={c.sun} />
      {/* 광안대교 — reference round (owner-supplied Busan vector): H-frame
          twin towers piered into the sea, one main cable swooping tower to
          tower, vertical hangers to the deck, deck running off-frame right.
          Drawn before the sea so the piers sink into the water band. */}
      <g>
        <path d="M316 252 V164 M329 252 V164 M512 252 V164 M525 252 V164" stroke={c.bridge} strokeWidth="4.5" strokeLinecap="round" />
        <path d="M312 171 H333 M508 171 H529" stroke={c.bridge} strokeWidth="3.5" strokeLinecap="round" />
        <rect x="236" y="208" width="484" height="4.5" rx="2.25" fill={c.bridge} />
        <path
          d="M240 205 Q280 164 322 163 Q420 204 518 163 Q622 184 720 202"
          fill="none"
          stroke={c.bridge}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M268 190 V208 M296 175 V208 M348 177 V208 M372 183 V208 M396 186 V208 M420 187 V208 M444 186 V208 M468 183 V208 M492 177 V208 M556 172 V208 M600 181 V208 M648 190 V208 M692 197 V208"
          stroke={c.bridge}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </g>
      {/* sea + foam */}
      <rect x="0" y="252" width="720" height="48" fill={c.sea} />
      {[190, 330, 470].map((x, i) => (
        <path
          key={i}
          d={`M${x} 266 q 12 -6 24 0 q 12 6 24 0`}
          fill="none"
          stroke={c.foam}
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.8"
        />
      ))}
      {/* 용궁사 — cliff rock + a chunky little stone pagoda */}
      <path d="M110 300 V246 Q168 218 226 246 Q252 262 264 300 Z" fill={c.headland} />
      <g>
        <rect x="168" y="212" width="40" height="13" rx="3" fill={c.pagoda} />
        <rect x="173" y="194" width="30" height="12" rx="3" fill={c.pagoda} />
        <rect x="178" y="177" width="20" height="11" rx="3" fill={c.pagoda} />
        <path d="M162 212 h52 M168 194 h40 M174 177 h28" stroke={c.pagodaRoof} strokeWidth="4.5" strokeLinecap="round" />
        <path d="M188 171 v-9" stroke={c.pagodaRoof} strokeWidth="3" strokeLinecap="round" />
      </g>
      {/* 해운대 beach, foreground right */}
      <path d="M240 300 Q460 268 720 284 V300 Z" fill={c.sand} />
      {/* 스카이캡슐 v2 — reference round (owner photo): chunky YELLOW cab,
          white roof cap + white lower skirt, one dark glass band split into
          panes, the round number badge, dark bogie riding a beam with a thin
          running tube on top. Mid-height rail = visible on the home canvas. */}
      <g>
        <path d="M396 152 H720" stroke={c.rail} strokeWidth="6" strokeLinecap="round" />
        <path d="M396 147.5 H720" stroke={c.rail} strokeWidth="1.8" strokeLinecap="round" />
        {[420, 500, 580, 660].map((x) => (
          <path key={x} d={`M${x} 154 V262`} stroke={c.rail} strokeWidth="3.5" strokeLinecap="round" />
        ))}
        <g>
          <rect x="462" y="140" width="46" height="8" rx="2.5" fill={c.capsuleWin} />
          <rect x="452" y="102" width="66" height="42" rx="12" fill={c.capsule} />
          <rect x="460" y="111" width="50" height="16" rx="7" fill={c.capsuleWin} />
          <rect x="474.5" y="111" width="3" height="16" fill={c.capsule} />
          <rect x="489" y="111" width="3" height="16" fill={c.capsule} />
          <rect x="458" y="98" width="54" height="9" rx="4.5" fill={c.capsuleTrim} />
          <rect x="496" y="93.5" width="11" height="5" rx="2" fill={c.rail} />
          <rect x="452" y="132" width="66" height="7" rx="3.5" fill={c.capsuleTrim} />
          <circle cx="464" cy="130" r="3.2" fill={c.capsuleTrim} />
          <circle cx="464" cy="130" r="1.5" fill={c.capsule} />
        </g>
      </g>
      <Cloud x={584} y={40} s={0.7} fill={c.foam} />
      <Bird x={330} y={40} stroke={c.gull} />
      <Bird x={365} y={28} s={0.75} stroke={c.gull} />
      <Bird x={470} y={56} s={0.85} stroke={c.gull} />
    </>
  );
}

function BlossomScene(c: Palette): ReactNode {
  return (
    <>
      <path d="M0 300 V252 Q200 210 420 236 Q590 262 720 244 V300 Z" fill={c.hillFar} />
      <path d="M0 300 V288 Q220 258 460 278 Q610 292 720 286 V300 Z" fill={c.hillNear} />
      {/* cherry branch dipping in from above, blossoms in the chat strip */}
      <g>
        <path
          d="M150 0 Q190 60 258 84 M212 44 Q228 72 258 84 M258 84 Q300 98 330 92"
          fill="none"
          stroke={c.branch}
          strokeWidth="5"
          strokeLinecap="round"
        />
        {[
          [215, 40, 9],
          [258, 84, 10],
          [330, 92, 9],
          [184, 64, 7],
        ].map(([x, y, r], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r={r} fill={c.bloomSoft} />
            <circle cx={(x as number) + 6} cy={(y as number) - 5} r={(r as number) * 0.7} fill={c.bloom} />
          </g>
        ))}
      </g>
      {/* drifting petals */}
      {[
        [390, 120, -24],
        [440, 70, 18],
        [490, 150, -10],
        [545, 100, 26],
        [430, 210, -18],
        [500, 250, 12],
        [350, 190, 20],
      ].map(([x, y, rot], i) => (
        <ellipse key={i} cx={x} cy={y} rx="6" ry="3.4" fill={c.petal} transform={`rotate(${rot} ${x} ${y})`} />
      ))}
    </>
  );
}

const SCENES: Record<ScenerySkin, (c: Palette) => ReactNode> = {
  classic: MountainsScene,
  sky: CloudsScene,
  winter: WinterScene,
  forest: ForestScene,
  meadow: MeadowScene,
  jeju: JejuScene,
  seoul: SeoulScene,
  busan: BusanScene,
  blossom: BlossomScene,
};

export default function SkinScenery({ skin, dark }: { skin: TourSkin; dark: boolean }) {
  if (skin === 'contrast') return null;
  const spec = SKIN_SCENERY_SPECS[skin as ScenerySkin];
  const render = SCENES[skin as ScenerySkin];
  if (!spec || !render) return null;
  return (
    <div
      aria-hidden
      data-testid="skin-scenery"
      className="pointer-events-none absolute inset-x-0 bottom-0 z-0 mx-auto w-full max-w-2xl select-none"
    >
      <svg viewBox="0 0 720 300" className="block h-[300px] w-full" preserveAspectRatio="xMidYMax slice" role="presentation">
        {render(dark ? spec.dark : spec.light)}
      </svg>
    </div>
  );
}
