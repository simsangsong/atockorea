'use client';

/**
 * T1.7 + T2.1/T2.2 — message composer.
 *
 * Text + quick-reply preset chips (pre-translated, zero LLM — §M-2 ②), plus
 * push-to-talk voice input:
 *
 *   record (≤60s, level animation) → POST /stt (transcribe only) → the
 *   transcript lands HERE in the input for review → sent via the normal
 *   text path.
 *
 * "Confirm before send" is the default (user decision 2026-07-14); switching
 * it off in Settings auto-sends clean transcripts, but a quality-flagged
 * transcript (server-authoritative needsConfirmation) always stops for
 * review. Devices without MediaRecorder simply never see the mic (O-9).
 */

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { QUICK_REPLY_PRESETS, type QuickReplyPreset } from '@/lib/tour-room/quickReplies';
import {
  isVoiceRecordingSupported,
  startVoiceRecording,
  MAX_RECORDING_MS,
  type ActiveRecording,
} from '@/lib/tour-room/recorder';
import { primeAudio } from '@/lib/tour-room/tts';
import { useTourRoomSettings } from '@/hooks/useTourRoomSettings';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

const PRESET_COOLDOWN_MS = 1500;

/** Pure double-tap guard: records the tap and reports whether it may fire. */
function shouldFirePreset(cooldowns: Map<string, number>, key: string, nowMs: number): boolean {
  const last = cooldowns.get(key) ?? 0;
  if (nowMs - last < PRESET_COOLDOWN_MS) return false;
  cooldowns.set(key, nowMs);
  return true;
}

const VOICE_COPY: Record<
  RoomLocale,
  { transcribing: string; confirmHint: string; micDenied: string; sttFailed: string; cancel: string; done: string }
> = {
  en: {
    transcribing: 'Listening & writing…',
    confirmHint: 'Check the text, then send',
    micDenied: 'Microphone is blocked — allow it in browser settings.',
    sttFailed: "Couldn't catch that — please try again.",
    cancel: 'Cancel',
    done: 'Done',
  },
  ko: {
    transcribing: '듣고 적는 중…',
    confirmHint: '내용을 확인하고 보내주세요',
    micDenied: '마이크가 차단되어 있어요 — 브라우저 설정에서 허용해 주세요.',
    sttFailed: '잘 못 알아들었어요 — 다시 말씀해 주세요.',
    cancel: '취소',
    done: '완료',
  },
  ja: {
    transcribing: '聞き取り中…',
    confirmHint: '内容を確認して送信してください',
    micDenied: 'マイクがブロックされています — ブラウザ設定で許可してください。',
    sttFailed: 'うまく聞き取れませんでした — もう一度お試しください。',
    cancel: 'キャンセル',
    done: '完了',
  },
  es: {
    transcribing: 'Escuchando y escribiendo…',
    confirmHint: 'Revisa el texto y envíalo',
    micDenied: 'El micrófono está bloqueado — permítelo en el navegador.',
    sttFailed: 'No se entendió bien — inténtalo de nuevo.',
    cancel: 'Cancelar',
    done: 'Listo',
  },
  zh: {
    transcribing: '正在听写…',
    confirmHint: '请确认内容后发送',
    micDenied: '麦克风被禁用 — 请在浏览器设置中允许。',
    sttFailed: '没有听清 — 请再试一次。',
    cancel: '取消',
    done: '完成',
  },
};

export interface VoiceTranscribeResult {
  text: string;
  needsConfirmation: boolean;
}

/** T4.7 — photo-question hook provided by the room client. */
export interface VisionAsk {
  ask: (
    file: File,
    options: { question: string; share: boolean },
  ) => Promise<{ answer: string; shared: boolean } | null>;
}

const VISION_COPY: Record<
  RoomLocale,
  { placeholder: string; private_: string; share: string; ask: string; asking: string; failed: string; close: string }
> = {
  en: { placeholder: 'Ask about this photo (optional)', private_: 'Only me', share: 'Share with room', ask: 'Ask', asking: 'Looking…', failed: 'Could not analyze — try again.', close: 'Close' },
  ko: { placeholder: '사진에 대해 물어보세요 (선택)', private_: '나만 보기', share: '방에 공유', ask: '질문하기', asking: '살펴보는 중…', failed: '분석하지 못했어요 — 다시 시도해 주세요.', close: '닫기' },
  ja: { placeholder: '写真について質問（任意）', private_: '自分だけ', share: 'ルームに共有', ask: '質問する', asking: '確認中…', failed: '分析できませんでした — もう一度お試しください。', close: '閉じる' },
  es: { placeholder: 'Pregunta sobre la foto (opcional)', private_: 'Solo yo', share: 'Compartir', ask: 'Preguntar', asking: 'Analizando…', failed: 'No se pudo analizar — inténtalo de nuevo.', close: 'Cerrar' },
  zh: { placeholder: '关于这张照片的问题（可选）', private_: '仅自己可见', share: '分享到房间', ask: '提问', asking: '识别中…', failed: '无法识别 — 请重试。', close: '关闭' },
};

export default function Composer({
  locale,
  onSendText,
  onSendPreset,
  transcribeVoice,
  vision,
  disabled = false,
}: {
  locale: RoomLocale;
  onSendText: (text: string) => void;
  onSendPreset: (preset: QuickReplyPreset) => void;
  /** T2.2 — provided by the room client; absent = voice input hidden. */
  transcribeVoice?: (blob: Blob, mimeType: string) => Promise<VoiceTranscribeResult | null>;
  /** T4.7 — photo questions; absent = camera button hidden. */
  vision?: VisionAsk;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState('');
  const [voiceState, setVoiceState] = useState<'idle' | 'recording' | 'transcribing'>('idle');
  const [level, setLevel] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [voiceNote, setVoiceNote] = useState<string | null>(null);
  const [confirmHint, setConfirmHint] = useState(false);
  const cooldowns = useRef<Map<string, number>>(new Map());
  const recordingRef = useRef<ActiveRecording | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { settings } = useTourRoomSettings();

  // T4.7 — photo question panel state.
  const [visionFile, setVisionFile] = useState<File | null>(null);
  const [visionPreview, setVisionPreview] = useState<string | null>(null);
  const [visionQuestion, setVisionQuestion] = useState('');
  const [visionShare, setVisionShare] = useState(false);
  const [visionState, setVisionState] = useState<'idle' | 'asking' | 'answered' | 'failed'>('idle');
  const [visionAnswer, setVisionAnswer] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const closeVision = () => {
    if (visionPreview) URL.revokeObjectURL(visionPreview);
    setVisionFile(null);
    setVisionPreview(null);
    setVisionQuestion('');
    setVisionAnswer('');
    setVisionState('idle');
  };

  const onPickImage = (file: File | null) => {
    if (!file) return;
    primeAudio();
    if (visionPreview) URL.revokeObjectURL(visionPreview);
    setVisionFile(file);
    setVisionPreview(URL.createObjectURL(file));
    setVisionAnswer('');
    setVisionState('idle');
  };

  const askVision = async () => {
    if (!vision || !visionFile) return;
    setVisionState('asking');
    const result = await vision.ask(visionFile, { question: visionQuestion.trim(), share: visionShare });
    if (!result) {
      setVisionState('failed');
      return;
    }
    if (result.shared) {
      closeVision(); // the answer arrives in the feed via broadcast
      return;
    }
    setVisionAnswer(result.answer);
    setVisionState('answered');
  };

  const [voiceSupported, setVoiceSupported] = useState(false);
  useEffect(() => {
    setVoiceSupported(Boolean(transcribeVoice) && isVoiceRecordingSupported());
  }, [transcribeVoice]);

  useEffect(() => () => recordingRef.current?.cancel(), []);

  const copy = VOICE_COPY[locale];

  const tapPreset = useCallback(
    (preset: QuickReplyPreset) => {
      primeAudio();
      if (!shouldFirePreset(cooldowns.current, preset.key, Date.now())) return;
      onSendPreset(preset);
    },
    [onSendPreset],
  );

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    setConfirmHint(false);
    onSendText(text);
  };

  const finishClip = useCallback(
    async (clip: { blob: Blob; mimeType: string } | null) => {
      recordingRef.current = null;
      if (!clip || !transcribeVoice) {
        setVoiceState('idle');
        return;
      }
      setVoiceState('transcribing');
      const result = await transcribeVoice(clip.blob, clip.mimeType);
      setVoiceState('idle');
      if (!result || !result.text) {
        setVoiceNote(copy.sttFailed);
        return;
      }
      // Auto-send only when the user opted out of confirmation AND the
      // server did not flag the transcript (T2.2 revised).
      if (!settings.voiceConfirm && !result.needsConfirmation) {
        onSendText(result.text);
        return;
      }
      setDraft(result.text);
      setConfirmHint(true);
      inputRef.current?.focus();
    },
    [transcribeVoice, settings.voiceConfirm, onSendText, copy.sttFailed],
  );

  const startRecording = useCallback(async () => {
    primeAudio();
    setVoiceNote(null);
    setConfirmHint(false);
    try {
      const recording = await startVoiceRecording({
        onLevel: setLevel,
        onElapsed: setElapsedMs,
        onFinish: (clip) => void finishClip(clip),
        onError: () => setVoiceState('idle'),
      });
      recordingRef.current = recording;
      setElapsedMs(0);
      setVoiceState('recording');
    } catch {
      setVoiceNote(copy.micDenied);
    }
  }, [finishClip, copy.micDenied]);

  if (disabled) return null;

  const seconds = Math.floor(elapsedMs / 1000);
  const timer = `0:${String(seconds % 60).padStart(2, '0')} / 1:00`;
  const nearCeiling = elapsedMs > MAX_RECORDING_MS - 10_000;

  return (
    <div>
      <div className="-mx-4 mb-2 flex gap-1.5 overflow-x-auto px-4 pb-1" data-testid="quick-replies">
        {QUICK_REPLY_PRESETS.map((preset) => (
          <button
            key={preset.key}
            type="button"
            onClick={() => tapPreset(preset)}
            className="shrink-0 rounded-full bg-white px-3 py-1.5 text-[12px] text-gray-700 shadow-sm ring-1 ring-gray-100 active:bg-amber-50 dark:bg-gray-900 dark:text-gray-300 dark:ring-gray-800"
          >
            {preset.emoji} {preset.text[locale]}
          </button>
        ))}
      </div>

      {visionFile && vision && (
        <div className="mb-1.5 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800" data-testid="vision-panel">
          <div className="flex gap-2.5">
            {visionPreview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={visionPreview} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
            )}
            <div className="min-w-0 flex-1">
              {visionState === 'answered' ? (
                <p className="max-h-40 overflow-y-auto text-[13px] leading-relaxed text-gray-800 dark:text-gray-100" data-testid="vision-answer">
                  {visionAnswer}
                </p>
              ) : (
                <>
                  <input
                    value={visionQuestion}
                    onChange={(e) => setVisionQuestion(e.target.value)}
                    maxLength={300}
                    placeholder={VISION_COPY[locale].placeholder}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-[13px] focus:border-amber-400 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  />
                  <label className="mt-1.5 flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                    <input
                      type="checkbox"
                      checked={visionShare}
                      onChange={(e) => setVisionShare(e.target.checked)}
                      className="accent-amber-500"
                    />
                    {visionShare ? VISION_COPY[locale].share : VISION_COPY[locale].private_}
                  </label>
                </>
              )}
              {visionState === 'failed' && (
                <p className="mt-1 text-[12px] text-red-600 dark:text-red-400">{VISION_COPY[locale].failed}</p>
              )}
            </div>
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={closeVision} className="rounded-xl px-3 py-1.5 text-[12px] font-medium text-gray-500 dark:text-gray-400">
              {VISION_COPY[locale].close}
            </button>
            {visionState !== 'answered' && (
              <button
                type="button"
                onClick={() => void askVision()}
                disabled={visionState === 'asking'}
                className="rounded-xl bg-amber-500 px-3.5 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
                data-testid="vision-ask-button"
              >
                {visionState === 'asking' ? VISION_COPY[locale].asking : `🔍 ${VISION_COPY[locale].ask}`}
              </button>
            )}
          </div>
        </div>
      )}

      {voiceNote && (
        <p className="mb-1.5 rounded-xl bg-red-50 px-3 py-2 text-[12px] text-red-600 dark:bg-red-950 dark:text-red-300" data-testid="voice-note">
          {voiceNote}
        </p>
      )}
      {confirmHint && draft.trim() && (
        <p className="mb-1.5 rounded-xl bg-amber-50 px-3 py-2 text-[12px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-200" data-testid="voice-confirm-hint">
          ✅ {copy.confirmHint}
        </p>
      )}

      {voiceState === 'recording' ? (
        <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900 dark:bg-red-950" data-testid="recording-bar">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
          <span className={`text-[13px] font-semibold tabular-nums ${nearCeiling ? 'text-red-600' : 'text-gray-700 dark:text-gray-200'}`}>
            {timer}
          </span>
          <div className="flex h-6 flex-1 items-center gap-0.5" aria-hidden>
            {Array.from({ length: 16 }, (_, i) => (
              <span
                key={i}
                className="w-1 rounded-full bg-red-400 transition-all duration-75"
                style={{ height: `${Math.max(15, Math.min(100, level * 100 * (0.6 + 0.4 * Math.sin(i * 1.7 + level * 8))))}%` }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              recordingRef.current?.cancel();
              recordingRef.current = null;
              setVoiceState('idle');
            }}
            className="rounded-xl px-3 py-2 text-[13px] font-medium text-gray-500 dark:text-gray-400"
          >
            {copy.cancel}
          </button>
          <button
            type="button"
            onClick={() => recordingRef.current?.stop()}
            className="rounded-xl bg-red-500 px-4 py-2 text-[13px] font-semibold text-white"
            data-testid="recording-done"
          >
            {copy.done}
          </button>
        </div>
      ) : voiceState === 'transcribing' ? (
        <div className="flex items-center gap-2.5 rounded-2xl border border-gray-200 bg-white px-4 py-3.5 dark:border-gray-700 dark:bg-gray-900" data-testid="transcribing-bar">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
          <span className="text-[13px] text-gray-600 dark:text-gray-300">{copy.transcribing}</span>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex items-end gap-2">
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (!e.target.value) setConfirmHint(false);
            }}
            maxLength={2000}
            className="min-w-0 flex-1 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-[14px] focus:border-amber-400 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
          {vision && !draft.trim() && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  onPickImage(e.target.files?.[0] ?? null);
                  e.target.value = '';
                }}
                data-testid="vision-file-input"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                aria-label="ask about a photo"
                className="rounded-2xl bg-white px-4 py-3 text-[16px] shadow-sm ring-1 ring-gray-200 active:bg-amber-50 dark:bg-gray-900 dark:ring-gray-700"
                data-testid="camera-button"
              >
                📷
              </button>
            </>
          )}
          {voiceSupported && !draft.trim() && (
            <button
              type="button"
              onClick={() => void startRecording()}
              aria-label="record voice message"
              className="rounded-2xl bg-white px-4 py-3 text-[16px] shadow-sm ring-1 ring-gray-200 active:bg-amber-50 dark:bg-gray-900 dark:ring-gray-700"
              data-testid="mic-button"
            >
              🎤
            </button>
          )}
          <button
            type="submit"
            disabled={!draft.trim()}
            className="rounded-2xl bg-amber-500 px-4 py-3 text-[14px] font-semibold text-white disabled:opacity-40"
            aria-label="send"
          >
            ➤
          </button>
        </form>
      )}
    </div>
  );
}
