'use client';

/**
 * T2.6 — guide-side live interpretation control.
 *
 * One switch: start speaking, travellers see captions in their language.
 * Tier A devices (Web Speech API) send text only; everywhere else the
 * energy-VAD chunker uploads 3–8s speech clips (silence never uploads).
 * "Keep a record" additionally persists each utterance as a room message.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  startCaptionCapture,
  detectCaptionTier,
  type CaptionCapture,
} from '@/lib/tour-room/captionCapture';
import { extensionForMime } from '@/lib/tour-room/recorder';
import { TTS_LANG } from '@/lib/tour-room/tts';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

const COPY: Record<
  RoomLocale,
  { start: string; stop: string; live: string; record: string; denied: string }
> = {
  en: { start: 'Start live captions', stop: 'Stop', live: 'Broadcasting captions', record: 'Keep a record', denied: 'Microphone is blocked — allow it in browser settings.' },
  ko: { start: '실시간 자막 방송 시작', stop: '중지', live: '자막 방송 중', record: '기록 남기기', denied: '마이크가 차단되어 있어요 — 브라우저 설정에서 허용해 주세요.' },
  ja: { start: 'ライブ字幕を開始', stop: '停止', live: '字幕配信中', record: '記録を残す', denied: 'マイクがブロックされています — ブラウザ設定で許可してください。' },
  es: { start: 'Iniciar subtítulos en vivo', stop: 'Detener', live: 'Emitiendo subtítulos', record: 'Guardar registro', denied: 'El micrófono está bloqueado — permítelo en el navegador.' },
  zh: { start: '开始实时字幕', stop: '停止', live: '字幕直播中', record: '保留记录', denied: '麦克风被禁用 — 请在浏览器设置中允许。' },
};

export default function GuideCaptionBar({
  bookingId,
  roomSession,
  locale,
}: {
  bookingId: string;
  roomSession: string;
  locale: RoomLocale;
}) {
  const [state, setState] = useState<'idle' | 'live'>('idle');
  const [record, setRecord] = useState(false);
  const [level, setLevel] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const captureRef = useRef<CaptionCapture | null>(null);
  const seqRef = useRef(0);
  const recordRef = useRef(false);
  recordRef.current = record;

  const [supported, setSupported] = useState(false);
  useEffect(() => {
    setSupported(detectCaptionTier() !== 'unsupported');
  }, []);

  useEffect(() => () => captureRef.current?.stop(), []);

  const copy = COPY[locale];
  const endpoint = `/api/tour-rooms/${encodeURIComponent(bookingId)}/captions`;

  const postText = useCallback(
    (text: string) => {
      seqRef.current += 1;
      void fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tour-room-auth': roomSession },
        body: JSON.stringify({ text, seq: seqRef.current, record: recordRef.current }),
      }).catch(() => undefined);
    },
    [endpoint, roomSession],
  );

  const postChunk = useCallback(
    (blob: Blob, mimeType: string) => {
      seqRef.current += 1;
      const form = new FormData();
      form.append('audio', new File([blob], `chunk-${seqRef.current}.${extensionForMime(mimeType)}`, { type: mimeType }));
      form.append('seq', String(seqRef.current));
      form.append('record', String(recordRef.current));
      void fetch(endpoint, {
        method: 'POST',
        headers: { 'x-tour-room-auth': roomSession },
        body: form,
      }).catch(() => undefined);
    },
    [endpoint, roomSession],
  );

  const start = useCallback(async () => {
    setNote(null);
    try {
      captureRef.current = await startCaptionCapture(
        { onText: postText, onChunk: postChunk, onLevel: setLevel },
        TTS_LANG[locale],
      );
      setState('live');
    } catch {
      setNote(copy.denied);
    }
  }, [postText, postChunk, locale, copy.denied]);

  const stop = useCallback(() => {
    captureRef.current?.stop();
    captureRef.current = null;
    setState('idle');
    setLevel(0);
  }, []);

  if (!supported) return null;

  return (
    <div className="mb-2" data-testid="guide-caption-bar">
      {note && (
        <p className="mb-1.5 rounded-xl bg-red-50 px-3 py-2 text-[12px] text-red-600 dark:bg-red-950 dark:text-red-300">{note}</p>
      )}
      {state === 'idle' ? (
        <button
          type="button"
          onClick={() => void start()}
          className="w-full rounded-2xl bg-gray-900 py-2.5 text-[13px] font-semibold text-white dark:bg-gray-100 dark:text-gray-900"
          data-testid="caption-start"
        >
          🎙 {copy.start}
        </button>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl bg-gray-900 px-4 py-2.5 text-white dark:bg-gray-100 dark:text-gray-900">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          <span className="text-[13px] font-semibold">{copy.live}</span>
          <span
            className="h-2 flex-1 overflow-hidden rounded-full bg-white/20 dark:bg-black/10"
            aria-hidden
          >
            <span
              className="block h-full rounded-full bg-emerald-400 transition-all duration-100"
              style={{ width: `${Math.max(4, level * 100)}%` }}
            />
          </span>
          <label className="flex shrink-0 items-center gap-1.5 text-[11px] opacity-90">
            <input type="checkbox" checked={record} onChange={(e) => setRecord(e.target.checked)} className="accent-emerald-400" />
            {copy.record}
          </label>
          <button
            type="button"
            onClick={stop}
            className="rounded-xl bg-white/15 px-3 py-1.5 text-[12px] font-semibold dark:bg-black/10"
            data-testid="caption-stop"
          >
            {copy.stop}
          </button>
        </div>
      )}
    </div>
  );
}
