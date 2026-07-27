/**
 * 음성 통역 파이프라인 레이턴시 실측 하니스.
 *
 * "실시간 통역 통화가 실용적인가"는 의견이 아니라 숫자로 답할 문제다. 이 스크립트는
 * 지금 프로덕션에서 도는 것과 **동일한 API·동일한 모델·동일한 프롬프트**로 각 구간을
 * 재서, 통화에 쓸 수 있는 예산(발화 종료 → 상대 귀)이 실제로 몇 초인지 확정한다.
 *
 *   node scripts/qa-voice-latency.mjs              ← 전체
 *   node scripts/qa-voice-latency.mjs --runs 5     ← 표본 늘리기
 *   node scripts/qa-voice-latency.mjs --skip-storage
 *   node scripts/qa-voice-latency.mjs --json out.json
 *
 * 🔴 의존성 0 (node18+ 내장 fetch/FormData/File만). node_modules 가 깨져 있어도 돈다 —
 *    이 레포의 워크트리는 node_modules 가 정션이거나 아예 없는 경우가 흔하다.
 *    그래서 lib/ai/router.ts 를 import 하지 않고 **같은 요청을 복제**한다
 *    (모델 gemini-2.5-flash-lite, 같은 시스템 프롬프트, 같은 max_tokens 산식).
 *    라우터 프롬프트를 고치면 여기 TRANSLATE_SYSTEM 도 같이 고쳐야 측정이 유효하다.
 *
 * 재는 것:
 *   A. TTS  — 현재 구현(전체 버퍼 await) vs 스트리밍 TTFB, 모델별
 *   B. STT  — 모델별, `prompt` 용어 바이어싱 ON/OFF (레이턴시 + 고유명사 보존율)
 *   C. MT   — 라우터 복제(gemini-2.5-flash-lite), 1로케일 vs 5로케일 팬아웃
 *   D. 저장 — Supabase Storage 업로드 + public URL (현재 TTS 서빙 경로의 숨은 비용)
 *   E. 합성 — 현재 아키텍처 vs 통화 최적화 아키텍처의 E2E 예산
 *
 * 🔴 편향 주의: 테스트 오디오는 TTS 가 만든 **깨끗한 음성**이다. 여기 STT 정확도는
 *    현실의 상한이고(주행 중 승합차·야외에서는 반드시 더 나쁘다), 레이턴시는
 *    마이크·VAD·업로드·재생을 뺀 **서버 구간만**이다. 둘 다 낙관 편향으로 읽을 것.
 *
 * 부작용: D 단계만 쓴다. `qa-voice-latency/` 프리픽스로만 올리고 finally 에서 지운다.
 */
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// env — 워크트리에는 .env.local 이 없을 수 있어 메인 레포까지 훑는다.
// ---------------------------------------------------------------------------

const ENV_CANDIDATES = [
  path.resolve(process.cwd(), '.env.local'),
  path.resolve(HERE, '..', '.env.local'),
  'C:/Users/sangsong/atockorea/.env.local',
  path.resolve(process.env.HOME || process.env.USERPROFILE || '.', 'atockorea/.env.local'),
];

function loadEnv() {
  for (const candidate of ENV_CANDIDATES) {
    if (!existsSync(candidate)) continue;
    for (const line of readFileSync(candidate, 'utf8').split(/\r?\n/)) {
      const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (!match) continue;
      if (!process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
    return candidate;
  }
  return '(none)';
}

const envPath = loadEnv();

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const option = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

const RUNS = Number(option('runs', '3'));
const SKIP_STORAGE = flag('skip-storage');
const JSON_OUT = option('json', '');

// ---------------------------------------------------------------------------
// 실측 표본 — 실제 가이드/기사가 할 법한 말. 고유명사와 숫자를 일부러 심었다.
// ---------------------------------------------------------------------------

const PHRASES = [
  { id: 'short', ko: '3시 30분에 주차장에서 만나요.', mustKeep: ['3', '30', '주차장'] },
  {
    id: 'medium',
    ko: '성산일출봉 정상까지 30분 정도 걸리고, 내려오면 흑돼지 점심 먹으러 갑니다.',
    mustKeep: ['성산일출봉', '30', '흑돼지'],
  },
  {
    id: 'long',
    ko: '오늘은 만장굴부터 보고 비자림으로 이동합니다. 비자림 입장료는 삼천 원이고 걷는 데 한 시간 정도 걸려요. 그다음 해녀박물관에서 공연을 보고 숙소로 돌아가겠습니다.',
    mustKeep: ['만장굴', '비자림', '삼천', '해녀박물관'],
  },
];

/** stt-router.ts 의 `prompt` 필드(900자 상한)에 넣을 "오늘의 용어집". */
const GLOSSARY_PROMPT =
  '제주 투어 가이드 안내입니다. 고유명사: 성산일출봉, 만장굴, 비자림, 해녀박물관, 우도, 천지연폭포, 한라산, 흑돼지, 갈치조림, 오메기떡.';

// ---------------------------------------------------------------------------
// 계측 유틸
// ---------------------------------------------------------------------------

function stats(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const at = (q) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] ?? 0;
  return { min: sorted[0] ?? 0, p50: at(0.5), p95: at(0.95), max: sorted.at(-1) ?? 0, n: sorted.length };
}

async function repeat(times, fn) {
  const samples = [];
  let last;
  for (let i = 0; i < times; i += 1) {
    try {
      const sample = await fn();
      samples.push(sample.ms);
      last = sample;
    } catch (error) {
      console.error(`    ! ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { samples, last };
}

const OPENAI = 'https://api.openai.com/v1';
const GROQ = 'https://api.groq.com/openai/v1';
const GEMINI_OPENAI = 'https://generativelanguage.googleapis.com/v1beta/openai';

function openaiKey() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY missing');
  return key;
}

/** stt-router.ts 와 같은 두 프로바이더. Groq 키가 없으면 그 행은 건너뛴다. */
const STT_PROVIDERS = {
  openai: { base: OPENAI, key: () => openaiKey() },
  groq: {
    base: GROQ,
    key: () => {
      const key = process.env.GROQ_API_KEY;
      if (!key) throw new Error('GROQ_API_KEY missing');
      return key;
    },
  },
};

// ---------------------------------------------------------------------------
// A. TTS — 전체 버퍼(현재 구현) vs 스트리밍 TTFB
// ---------------------------------------------------------------------------

/** lib/openai-server.ts generateSpeechMp3 과 동일 — 전체 버퍼를 기다린다. */
async function ttsFull(text, model) {
  const started = performance.now();
  const res = await fetch(`${OPENAI}/audio/speech`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${openaiKey()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, voice: 'alloy', input: text, response_format: 'mp3' }),
  });
  if (!res.ok) throw new Error(`tts ${model}: ${res.status} ${(await res.text()).slice(0, 160)}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  return { ms: performance.now() - started, buffer, meta: { bytes: buffer.length } };
}

/** 통화에 쓰려면 이 값이 예산이다 — 첫 오디오 바이트까지. */
async function ttsStreamTtfb(text, model) {
  const started = performance.now();
  const res = await fetch(`${OPENAI}/audio/speech`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${openaiKey()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, voice: 'alloy', input: text, response_format: 'mp3' }),
  });
  if (!res.ok || !res.body) throw new Error(`tts stream ${model}: ${res.status}`);
  const reader = res.body.getReader();
  let ttfb = 0;
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!ttfb) ttfb = performance.now() - started;
    bytes += value?.length ?? 0;
  }
  return { ms: ttfb, meta: { totalMs: performance.now() - started, bytes } };
}

// ---------------------------------------------------------------------------
// B. STT
// ---------------------------------------------------------------------------

async function sttOnce(audio, provider, model, prompt) {
  const def = STT_PROVIDERS[provider];
  const body = new FormData();
  body.append('model', model);
  body.append('file', new File([new Uint8Array(audio)], 'utterance.mp3', { type: 'audio/mpeg' }));
  // stt-router.ts supportsVerboseJson — whisper 계열만 verbose_json 을 받는다.
  body.append('response_format', /whisper/i.test(model) ? 'verbose_json' : 'json');
  if (prompt) body.append('prompt', prompt.slice(0, 900));

  const started = performance.now();
  const res = await fetch(`${def.base}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${def.key()}` },
    body,
  });
  if (!res.ok) throw new Error(`stt ${provider}/${model}: ${res.status} ${(await res.text()).slice(0, 160)}`);
  const data = await res.json();
  return { ms: performance.now() - started, text: (data.text ?? '').trim() };
}

const keepRate = (transcript, mustKeep) =>
  mustKeep.length === 0 ? 1 : mustKeep.filter((t) => transcript.includes(t)).length / mustKeep.length;

// ---------------------------------------------------------------------------
// C. MT — lib/ai/router.ts translateTextViaRouter 의 요청을 그대로 복제
// ---------------------------------------------------------------------------

const TRANSLATE_SYSTEM =
  'Detect the source language. Translate the user text into each requested locale. ' +
  'Always write each translation in the polite, formal register of the target language ' +
  '(Korean 존댓말, Japanese 敬語/です・ます体, French vous, German Sie, Spanish usted, and the equivalent elsewhere), ' +
  'even when the source text is casual, blunt, or impolite — but never change, add, or omit any meaning, information, or content. ' +
  'Write it the way a courteous NATIVE SPEAKER would actually say it to a traveller: idiomatic, natural word order, ' +
  'natural particles and connectives. Do not mirror the source sentence structure, and do not translate word by word. ' +
  'A stiff literal rendering is a failure even when every word is correct. ' +
  'Preserve names, times, pickup points, prices, and URLs. ' +
  'Respond with only a JSON object of the form {"source_locale": string, "translations": {locale: string}}.';

/** router.ts L593-594 의 산식 그대로. */
function translateOutputCap(text, localeCount) {
  const perLocale = 64 + Math.ceil(text.length * 1.5);
  return Math.min(8000, Math.max(1200, 160 + localeCount * perLocale));
}

async function translateOnce(text, targets) {
  const geminiKey = process.env.GEMINI_API_KEY;
  const useGemini = Boolean(geminiKey);
  const baseUrl = useGemini ? GEMINI_OPENAI : OPENAI;
  const model = useGemini ? 'gemini-2.5-flash-lite' : process.env.OPENAI_TEXT_MODEL || 'gpt-5-mini';
  const tokenField = useGemini ? 'max_tokens' : 'max_completion_tokens';

  const started = performance.now();
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${useGemini ? geminiKey : openaiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: TRANSLATE_SYSTEM },
        { role: 'user', content: JSON.stringify({ text, target_locales: targets }) },
      ],
      response_format: { type: 'json_object' },
      [tokenField]: translateOutputCap(text, targets.length),
    }),
  });
  if (!res.ok) throw new Error(`mt ${model}: ${res.status} ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const ms = performance.now() - started;
  let translations = {};
  try {
    translations = JSON.parse(data.choices?.[0]?.message?.content ?? '{}').translations ?? {};
  } catch {
    /* 파싱 실패도 레이턴시 표본으로는 유효 */
  }
  return { ms, meta: { model, en: translations.en } };
}

// ---------------------------------------------------------------------------
// D. Storage — 현재 TTS 서빙 경로의 숨은 왕복 (REST, SDK 불필요)
// ---------------------------------------------------------------------------

async function measureStorage(buffer, runs) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('  ! SUPABASE URL/SERVICE_ROLE 없음 — 저장 구간 건너뜀');
    return { samples: [], cleaned: 0 };
  }
  const bucket = process.env.SUPABASE_TOUR_AUDIO_BUCKET || 'tour-audio';
  const paths = [];
  const samples = [];

  try {
    for (let i = 0; i < runs; i += 1) {
      const storagePath = `qa-voice-latency/${randomUUID()}.mp3`;
      const started = performance.now();
      const res = await fetch(`${url}/storage/v1/object/${bucket}/${storagePath}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'audio/mpeg',
          'x-upsert': 'true',
        },
        body: buffer,
      });
      if (!res.ok) {
        console.error(`  ! storage upload: ${res.status} ${(await res.text()).slice(0, 160)}`);
        continue;
      }
      // getPublicUrl 은 순수 문자열 조립이라 왕복이 없다 — 업로드가 곧 비용.
      samples.push(performance.now() - started);
      paths.push(storagePath);
    }
  } finally {
    if (paths.length > 0) {
      const res = await fetch(`${url}/storage/v1/object/${bucket}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefixes: paths }),
      });
      if (!res.ok) console.error(`  ! 정리 실패(수동 삭제 필요): ${paths.join(', ')}`);
    }
  }
  return { samples, cleaned: paths.length };
}

// ---------------------------------------------------------------------------
// 리포트
// ---------------------------------------------------------------------------

const pad = (v, w = 6) => `${Math.round(v)}`.padStart(w);
const row = (label, s, extra = '') => `  ${label.padEnd(50)} ${pad(s.min)} ${pad(s.p50)} ${pad(s.p95)}  (n=${s.n}) ${extra}`;

async function main() {
  console.log('='.repeat(100));
  console.log('음성 통역 파이프라인 레이턴시 실측');
  console.log(`env: ${envPath} · runs=${RUNS} · node ${process.version}`);
  console.log(
    `키: OPENAI=${process.env.OPENAI_API_KEY ? 'Y' : 'N'} GEMINI=${process.env.GEMINI_API_KEY ? 'Y' : 'N'} GROQ=${process.env.GROQ_API_KEY ? 'Y' : 'N'} SUPABASE=${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Y' : 'N'}`,
  );
  console.log('='.repeat(100));
  console.log('  단위 ms · 컬럼 = min / p50 / p95\n');

  const report = { envPath, runs: RUNS, at: new Date().toISOString(), tts: {}, stt: {}, mt: {} };

  // -- A --------------------------------------------------------------------
  console.log('[A] TTS — 현재 구현(전체 버퍼) vs 스트리밍 TTFB');
  const TTS_MODELS = ['gpt-4o-mini-tts', 'tts-1'];
  const audioByPhrase = new Map();

  for (const model of TTS_MODELS) {
    for (const phrase of PHRASES) {
      const full = await repeat(RUNS, async () => {
        const sample = await ttsFull(phrase.ko, model);
        if (model === TTS_MODELS[0] && !audioByPhrase.has(phrase.id)) audioByPhrase.set(phrase.id, sample.buffer);
        return sample;
      });
      const stream = await repeat(RUNS, () => ttsStreamTtfb(phrase.ko, model));
      const fullStats = stats(full.samples);
      const streamStats = stats(stream.samples);
      console.log(row(`${model} · ${phrase.id} · 전체버퍼`, fullStats, `${full.last?.meta?.bytes ?? '?'}B`));
      console.log(row(`${model} · ${phrase.id} · 스트리밍 TTFB`, streamStats, '← 통화 예산'));
      report.tts[`${model}/${phrase.id}`] = { full: fullStats, streamTtfb: streamStats };
    }
    console.log('');
  }

  // -- B --------------------------------------------------------------------
  console.log('[B] STT — 프로바이더·모델별 + 용어 바이어싱(prompt) ON/OFF');
  // groq 가 stt-router.ts 의 STT_PRIMARY_PROVIDER 기본값이므로 맨 앞에 둔다.
  const STT_MODELS = [
    ['groq', 'whisper-large-v3-turbo'],
    ['groq', 'whisper-large-v3'],
    ['openai', 'whisper-1'],
    ['openai', 'gpt-4o-mini-transcribe'],
  ];

  for (const [provider, model] of STT_MODELS) {
    if (provider === 'groq' && !process.env.GROQ_API_KEY) {
      console.log(`  (skip) ${provider}/${model} — GROQ_API_KEY 없음`);
      continue;
    }
    for (const phrase of PHRASES) {
      const audio = audioByPhrase.get(phrase.id);
      if (!audio) continue;
      for (const biased of [false, true]) {
        const result = await repeat(RUNS, () =>
          sttOnce(audio, provider, model, biased ? GLOSSARY_PROMPT : undefined),
        );
        const s = stats(result.samples);
        const transcript = result.last?.text ?? '';
        const keep = keepRate(transcript, phrase.mustKeep);
        console.log(
          row(`${provider}/${model} · ${phrase.id} · bias=${biased ? 'ON ' : 'OFF'}`, s, `용어보존 ${Math.round(keep * 100)}%`),
        );
        if (keep < 1) console.log(`       → "${transcript}"`);
        report.stt[`${provider}/${model}/${phrase.id}/bias-${biased}`] = { ...s, keepRate: keep, transcript };
      }
    }
    console.log('');
  }

  // -- C --------------------------------------------------------------------
  console.log('[C] MT — 라우터 복제 (gemini-2.5-flash-lite, 캐시 OFF)');
  for (const phrase of PHRASES) {
    for (const targets of [['en'], ['en', 'zh', 'ja', 'es']]) {
      const label = `${phrase.id} · ko→${targets.length === 1 ? 'en    ' : `${targets.length}로케일`}`;
      const result = await repeat(RUNS, () => translateOnce(phrase.ko, targets));
      const s = stats(result.samples);
      console.log(row(label, s));
      if (result.last?.meta?.en) console.log(`       → "${result.last.meta.en}"`);
      report.mt[label.replace(/\s+/g, ' ').trim()] = s;
    }
  }
  console.log('');

  // -- D --------------------------------------------------------------------
  if (!SKIP_STORAGE) {
    console.log('[D] Storage — 현재 TTS 서빙 경로 (업로드; getPublicUrl 은 왕복 없음)');
    const sampleAudio = audioByPhrase.get('medium');
    if (sampleAudio) {
      const { samples, cleaned } = await measureStorage(sampleAudio, RUNS);
      if (samples.length > 0) {
        const s = stats(samples);
        console.log(row('supabase storage upload', s, `정리 ${cleaned}건`));
        report.storage = s;
      }
    }
    console.log('');
  }

  // -- E --------------------------------------------------------------------
  console.log('[E] 합성 E2E 예산 — medium 발화, p50, 서버 구간만');
  const g = (obj, key, field = 'p50') => obj?.[key]?.[field] ?? 0;
  // 현재 = 라우터 기본 사다리의 1순위(groq turbo). 없으면 openai whisper-1.
  const sttSlow =
    g(report.stt, 'groq/whisper-large-v3-turbo/medium/bias-true') ||
    g(report.stt, 'openai/whisper-1/medium/bias-true');
  // 최적화 = medium/bias-ON 중 실측 최속.
  const sttCandidates = Object.entries(report.stt)
    .filter(([key]) => key.endsWith('/medium/bias-true'))
    .map(([key, value]) => ({ key, p50: value.p50 }))
    .sort((a, b) => a.p50 - b.p50);
  const sttFast = sttCandidates[0]?.p50 ?? 0;
  const sttFastName = sttCandidates[0]?.key.replace('/medium/bias-true', '') ?? '?';
  const mt1 = g(report.mt, 'medium · ko→en');
  const mt5 = g(report.mt, 'medium · ko→4로케일');
  const ttsCurrent = report.tts['gpt-4o-mini-tts/medium']?.full?.p50 ?? 0;
  // 모델 고정이 아니라 medium 스트리밍 TTFB 실측 최속을 쓴다 — tts-1 이 항상
  // 빠르다는 가정은 2026-07-27 측정에서 이미 반증됐다(§B-3).
  const ttsFast = Math.min(
    ...Object.entries(report.tts)
      .filter(([key]) => key.endsWith('/medium'))
      .map(([, value]) => value.streamTtfb?.p50 ?? Infinity),
  );
  const storage = report.storage?.p50 ?? 0;

  const current = sttSlow + mt5 + ttsCurrent + storage;
  const optimized = sttFast + mt1 + ttsFast;

  console.log('  현재 아키텍처 (비동기 메시지 경로를 그대로 통화에 쓸 경우)');
  console.log(`    STT  라우터 1순위               ${pad(sttSlow)}`);
  console.log(`    MT   다로케일 팬아웃            ${pad(mt5)}`);
  console.log(`    TTS  gpt-4o-mini-tts 전체버퍼   ${pad(ttsCurrent)}`);
  console.log(`    저장 supabase 업로드            ${pad(storage)}`);
  console.log(`    ${'합계'.padEnd(28)} ${pad(current)} ms`);
  console.log('');
  console.log('  통화 최적화 아키텍처 (1:1 타깃 · 최속 모델 · 스트리밍 · 저장 없음)');
  console.log(`    STT  ${sttFastName.padEnd(26)}${pad(sttFast)}`);
  console.log(`    MT   1로케일                   ${pad(mt1)}`);
  console.log(`    TTS  스트리밍 TTFB             ${pad(ttsFast)}`);
  console.log(`    ${'합계'.padEnd(28)} ${pad(optimized)} ms`);
  console.log('');
  console.log(`  서버 구간 절감: ${Math.round(current - optimized)} ms (${current > 0 ? Math.round((1 - optimized / current) * 100) : 0}%)`);
  console.log('');
  console.log('  ⚠ 아직 안 들어간 것: VAD 엔드포인팅(현재 400ms) · 업로드 네트워크(모바일 LTE 200~600ms)');
  console.log('    · 재생 시작 지연 · 지터 버퍼. 실제 체감 ≒ 위 합계 + 0.8~1.5초.');

  report.composed = { current, optimized };

  if (JSON_OUT) {
    writeFileSync(JSON_OUT, JSON.stringify(report, null, 2), 'utf8');
    console.log(`\n  → ${JSON_OUT}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
