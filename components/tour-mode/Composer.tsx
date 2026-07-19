'use client';

/**
 * T1.7 + T2.1/T2.2 → U4 — message composer, messenger grammar (plan §G):
 * a docked surface bar with an auto-growing pill textarea, inline camera /
 * mic icon buttons that yield to a circular send button once a draft exists
 * (Telegram morph), quick-reply chips riding the canvas above the bar.
 *
 * Voice flow (unchanged logic):
 *   record (≤60s, level animation) → POST /stt (transcribe only) → the
 *   transcript lands HERE in the input for review → sent via the normal
 *   text path.
 *
 * "Confirm before send" is the default (user decision 2026-07-14); switching
 * it off in Settings auto-sends clean transcripts, but a quality-flagged
 * transcript (server-authoritative needsConfirmation) always stops for
 * review. Devices without MediaRecorder simply never see the mic (O-9).
 */

import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { QUICK_REPLY_PRESETS, type QuickReplyPreset } from '@/lib/tour-room/quickReplies';
import {
  isVoiceRecordingSupported,
  startVoiceRecording,
  MAX_RECORDING_MS,
  type ActiveRecording,
} from '@/lib/tour-room/recorder';
import { isDeviceSttSupported, startDeviceStt, type DeviceSttHandle } from '@/lib/tour-room/deviceStt';
import { primeAudio, TTS_LANG } from '@/lib/tour-room/tts';
import { useTourRoomSettings } from '@/hooks/useTourRoomSettings';
import {
  IconAsk,
  IconCamera,
  IconDone,
  IconMic,
  IconSend,
} from '@/components/tour-mode/icons';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

const PRESET_COOLDOWN_MS = 1500;

/** Pure double-tap guard: records the tap and reports whether it may fire. */
function shouldFirePreset(cooldowns: Map<string, number>, key: string, nowMs: number): boolean {
  const last = cooldowns.get(key) ?? 0;
  if (nowMs - last < PRESET_COOLDOWN_MS) return false;
  cooldowns.set(key, nowMs);
  return true;
}

const PLACEHOLDER: Record<RoomLocale, string> = {
  en: 'Message',
  ko: '메시지 보내기',
  ja: 'メッセージを入力',
  es: 'Mensaje',
  zh: '发送消息',
};

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

const MAX_TEXTAREA_PX = 128; // ~5 lines of tr-body

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
  // Device STT (Web Speech) is preferred when the browser supports it — the
  // transcript lands instantly with no server round trip; `interim` streams the
  // live words. `recMode` says which engine the current capture uses.
  const [recMode, setRecMode] = useState<'device' | 'audio'>('audio');
  const [interim, setInterim] = useState('');
  const deviceRef = useRef<DeviceSttHandle | null>(null);
  const cooldowns = useRef<Map<string, number>>(new Map());
  const recordingRef = useRef<ActiveRecording | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
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
    // Post-mount capability probe (window-only APIs) — kept out of the initial
    // render for hydration safety; nested so it isn't a bare effect-body setState.
    const detect = () => setVoiceSupported(Boolean(transcribeVoice) && isVoiceRecordingSupported());
    detect();
  }, [transcribeVoice]);

  useEffect(
    () => () => {
      recordingRef.current?.cancel();
      deviceRef.current?.cancel();
    },
    [],
  );

  const copy = VOICE_COPY[locale];

  const tapPreset = useCallback(
    (preset: QuickReplyPreset) => {
      primeAudio();
      if (!shouldFirePreset(cooldowns.current, preset.key, Date.now())) return;
      onSendPreset(preset);
    },
    [onSendPreset],
  );

  // U4.1 — auto-grow the pill up to ~5 lines, then scroll inside.
  const autosize = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_PX)}px`;
  }, []);

  const submitDraft = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    setConfirmHint(false);
    if (inputRef.current) inputRef.current.style.height = 'auto';
    onSendText(text);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    submitDraft();
  };

  // Desktop convention: Enter sends, Shift+Enter breaks the line. Mobile
  // keyboards emit newline through onChange and never hit this branch.
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submitDraft();
    }
  };

  // Confirm-before-send contract, shared by both engines: auto-send only when
  // the user opted out AND nothing flagged the transcript; otherwise the text
  // lands in the input for review (T2.2). Device STT is never server-flagged.
  const applyTranscript = useCallback(
    (text: string, needsConfirmation: boolean) => {
      if (!text) {
        setVoiceNote(copy.sttFailed);
        return;
      }
      if (!settings.voiceConfirm && !needsConfirmation) {
        onSendText(text);
        return;
      }
      setDraft(text);
      setConfirmHint(true);
      inputRef.current?.focus();
    },
    [settings.voiceConfirm, onSendText, copy.sttFailed],
  );

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
      applyTranscript(result?.text ?? '', Boolean(result?.needsConfirmation));
    },
    [transcribeVoice, applyTranscript],
  );

  const startRecording = useCallback(async () => {
    primeAudio();
    setVoiceNote(null);
    setConfirmHint(false);
    setInterim('');
    // Preferred: device STT (free, instant, no upload). The transcript flows
    // through the same confirm-before-send path as the server result.
    if (isDeviceSttSupported()) {
      setRecMode('device');
      setVoiceState('recording');
      deviceRef.current = startDeviceStt({
        lang: TTS_LANG[locale] ?? 'en-US',
        onPartial: setInterim,
        onFinal: (text) => {
          deviceRef.current = null;
          setVoiceState('idle');
          applyTranscript(text, false);
        },
      });
      return;
    }
    setRecMode('audio');
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
  }, [finishClip, copy.micDenied, locale, applyTranscript]);

  const stopRecording = useCallback(() => {
    if (recMode === 'device') deviceRef.current?.stop();
    else recordingRef.current?.stop();
  }, [recMode]);

  const cancelRecording = useCallback(() => {
    if (recMode === 'device') {
      deviceRef.current?.cancel();
      deviceRef.current = null;
    } else {
      recordingRef.current?.cancel();
      recordingRef.current = null;
    }
    setInterim('');
    setVoiceState('idle');
  }, [recMode]);

  if (disabled) return null;

  const seconds = Math.floor(elapsedMs / 1000);
  const timer = `0:${String(seconds % 60).padStart(2, '0')} / 1:00`;
  const nearCeiling = elapsedMs > MAX_RECORDING_MS - 10_000;
  const hasDraft = Boolean(draft.trim());

  return (
    <div className="-mx-3">
      {/* Quick replies ride the canvas just above the docked bar. */}
      <div className="mb-1.5 flex gap-1.5 overflow-x-auto px-3 pb-1" data-testid="quick-replies">
        {QUICK_REPLY_PRESETS.map((preset) => (
          <button
            key={preset.key}
            type="button"
            onClick={() => tapPreset(preset)}
            className="tr-label shrink-0 rounded-full bg-[var(--tr-surface)] px-3.5 py-2 text-[var(--tr-ink-2)] transition-transform active:scale-95"
          >
            {preset.emoji} {preset.text[locale]}
          </button>
        ))}
      </div>

      {visionFile && vision && (
        <div className="tr-card mx-3 mb-1.5 p-3" data-testid="vision-panel">
          <div className="flex gap-2.5">
            {visionPreview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={visionPreview} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
            )}
            <div className="min-w-0 flex-1">
              {visionState === 'answered' ? (
                <p className="tr-card-text max-h-40 overflow-y-auto text-[var(--tr-ink)]" data-testid="vision-answer">
                  {visionAnswer}
                </p>
              ) : (
                <>
                  <input
                    value={visionQuestion}
                    onChange={(e) => setVisionQuestion(e.target.value)}
                    maxLength={300}
                    placeholder={VISION_COPY[locale].placeholder}
                    className="tr-card-text w-full rounded-xl bg-[var(--tr-surface-2)] px-3 py-2 text-[var(--tr-ink)] placeholder:text-[var(--tr-ink-3)] focus:outline-none focus:ring-2 focus:ring-[var(--tr-accent)]"
                  />
                  <label className="tr-meta mt-2 flex items-center gap-1.5 text-[var(--tr-ink-2)]">
                    <input
                      type="checkbox"
                      checked={visionShare}
                      onChange={(e) => setVisionShare(e.target.checked)}
                      className="h-4 w-4 accent-[var(--tr-accent)]"
                    />
                    {visionShare ? VISION_COPY[locale].share : VISION_COPY[locale].private_}
                  </label>
                </>
              )}
              {visionState === 'failed' && (
                <p className="tr-label mt-1 text-[var(--tr-danger)]">{VISION_COPY[locale].failed}</p>
              )}
            </div>
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={closeVision}
              className="tr-label min-h-[40px] rounded-full px-4 font-medium text-[var(--tr-ink-2)]"
            >
              {VISION_COPY[locale].close}
            </button>
            {visionState !== 'answered' && (
              <button
                type="button"
                onClick={() => void askVision()}
                disabled={visionState === 'asking'}
                className="tr-label flex min-h-[40px] items-center gap-1.5 rounded-full bg-[var(--tr-accent)] px-4 font-semibold text-[var(--tr-bubble-me-ink)] disabled:opacity-50"
                data-testid="vision-ask-button"
              >
                <IconAsk size={14} aria-hidden />
                {visionState === 'asking' ? VISION_COPY[locale].asking : VISION_COPY[locale].ask}
              </button>
            )}
          </div>
        </div>
      )}

      {voiceNote && (
        <p
          className="tr-label mx-3 mb-1.5 rounded-xl bg-[var(--tr-danger-soft)] px-3 py-2 text-[var(--tr-danger)]"
          data-testid="voice-note"
        >
          {voiceNote}
        </p>
      )}
      {confirmHint && hasDraft && (
        <p
          className="tr-label mx-3 mb-1.5 rounded-xl bg-[var(--tr-accent-soft)] px-3 py-2 font-medium text-[var(--tr-accent-deep)]"
          data-testid="voice-confirm-hint"
        >
          {copy.confirmHint}
        </p>
      )}

      {/* Docked bar — full-bleed surface with a hairline, like every messenger. */}
      <div className="tr-hairline-t bg-[var(--tr-surface)] px-3 py-2">
        {voiceState === 'recording' ? (
          <div className="flex items-center gap-3 rounded-[var(--tr-radius-input)] bg-[var(--tr-danger-soft)] px-4 py-2.5" data-testid="recording-bar">
            <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-[var(--tr-danger)]" />
            {recMode === 'device' ? (
              <p
                className="tr-label min-w-0 flex-1 truncate font-medium text-[var(--tr-ink)]"
                data-testid="recording-interim"
              >
                {interim || copy.transcribing}
              </p>
            ) : (
              <>
                <span
                  className={`tr-label font-semibold tabular-nums ${
                    nearCeiling ? 'text-[var(--tr-danger)]' : 'text-[var(--tr-ink)]'
                  }`}
                >
                  {timer}
                </span>
                <div className="flex h-6 flex-1 items-center gap-0.5" aria-hidden>
                  {Array.from({ length: 16 }, (_, i) => (
                    <span
                      key={i}
                      className="w-1 rounded-full bg-[var(--tr-danger)] opacity-80 transition-all duration-75"
                      style={{ height: `${Math.max(15, Math.min(100, level * 100 * (0.6 + 0.4 * Math.sin(i * 1.7 + level * 8))))}%` }}
                    />
                  ))}
                </div>
              </>
            )}
            <button
              type="button"
              onClick={cancelRecording}
              className="tr-label min-h-[40px] shrink-0 rounded-full px-3 font-medium text-[var(--tr-ink-2)]"
            >
              {copy.cancel}
            </button>
            <button
              type="button"
              onClick={stopRecording}
              className="tr-label flex min-h-[40px] shrink-0 items-center gap-1 rounded-full bg-[var(--tr-danger)] px-4 font-semibold text-white"
              data-testid="recording-done"
            >
              <IconDone size={14} aria-hidden />
              {copy.done}
            </button>
          </div>
        ) : voiceState === 'transcribing' ? (
          <div
            className="flex items-center gap-2.5 rounded-[var(--tr-radius-input)] bg-[var(--tr-surface-2)] px-4 py-3"
            data-testid="transcribing-bar"
          >
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--tr-accent)] border-t-transparent" />
            <span className="tr-card-text text-[var(--tr-ink-2)]">{copy.transcribing}</span>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex items-end gap-1.5">
            {vision && !hasDraft && (
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
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--tr-ink-2)] active:bg-[var(--tr-bubble-system)]"
                  data-testid="camera-button"
                >
                  <IconCamera size={22} strokeWidth={2} />
                </button>
              </>
            )}
            <textarea
              ref={inputRef}
              value={draft}
              rows={1}
              onChange={(e) => {
                setDraft(e.target.value);
                if (!e.target.value) setConfirmHint(false);
                autosize();
              }}
              onKeyDown={onKeyDown}
              maxLength={2000}
              placeholder={PLACEHOLDER[locale]}
              enterKeyHint="send"
              className={`tr-body min-w-0 flex-1 resize-none rounded-[var(--tr-radius-input)] bg-[var(--tr-surface-2)] px-4 py-2.5 text-[var(--tr-ink)] placeholder:text-[var(--tr-ink-3)] focus:outline-none ${
                confirmHint && hasDraft ? 'ring-2 ring-[var(--tr-accent)]' : ''
              }`}
            />
            {voiceSupported && !hasDraft && (
              <button
                type="button"
                onClick={() => void startRecording()}
                aria-label="record voice message"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--tr-ink-2)] active:bg-[var(--tr-bubble-system)]"
                data-testid="mic-button"
              >
                <IconMic size={22} strokeWidth={2} />
              </button>
            )}
            {hasDraft && (
              <button
                type="submit"
                aria-label="send"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--tr-accent)] text-[var(--tr-bubble-me-ink)] transition-transform active:scale-95"
              >
                <IconSend size={20} strokeWidth={2.5} />
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
