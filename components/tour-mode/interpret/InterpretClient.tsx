'use client';

/**
 * V1 대면 통역 — 폰 하나를 둘이 보는 화면.
 *
 * 위쪽은 **180° 돌아가 있다.** 테이블 건너 상대(식당 주인·약사·기사)가 폰을
 * 자기 쪽에서 읽는다. 아래쪽은 손님. 각 면에 자기 마이크가 있고, 누른 쪽이
 * 말한 쪽이다 — 자동 화자 분리는 소음 환경에서 믿을 게 못 된다.
 *
 * 설계 근거(§V1):
 *   · **누르고 말하기.** 마이크가 상시 열려 있으면 차 소리·옆 테이블이 다 들어간다.
 *     실측상 소음이 정확도 천장을 정하고, 그건 모델로 못 고친다.
 *   · **자막이 1차 채널.** 대면에서는 상대가 화면을 보고 있다. TTS 는 보조다.
 *   · **숫자 경고.** 시간·금액·인원이 번역에서 증발하면 원문을 같이 띄운다.
 *     조용히 틀린 시각을 말하는 것보다 낫다.
 */

import { useCallback, useRef, useState } from 'react';

import { pickRecorderMimeType } from '@/lib/tour-room/recorder';
import { primeAudio, speakWithDevice } from '@/lib/tour-room/tts';
import { normalizeRoomLocale } from '@/lib/tour-room/snapshot';
import type { InterpretSide } from '@/lib/tour-room/interpret';

interface Turn {
  id: number;
  side: InterpretSide;
  sourceText: string;
  translatedText: string;
  to: string;
  droppedNumbers: string[];
}

interface Props {
  bookingId: string;
  roomSession: string;
  guestLocale: string;
  /** 손님 UI 문구. 상대 쪽은 늘 한국어다(눈앞의 상대가 한국인이라는 전제). */
  copy: {
    guestPrompt: string;
    localPrompt: string;
    listening: string;
    working: string;
    numbersWarning: string;
    empty: string;
    error: string;
  };
}

const MAX_TURNS = 12;

export default function InterpretClient({ bookingId, roomSession, guestLocale, copy }: Props) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busySide, setBusySide] = useState<InterpretSide | null>(null);
  const [recordingSide, setRecordingSide] = useState<InterpretSide | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const turnIdRef = useRef(0);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const send = useCallback(
    async (side: InterpretSide, blob: Blob, mimeType: string) => {
      setBusySide(side);
      setError(null);
      try {
        const form = new FormData();
        form.append('audio', blob, `turn.${mimeType.includes('mp4') ? 'mp4' : 'webm'}`);
        form.append('side', side);
        form.append('guestLocale', guestLocale);

        const res = await fetch(`/api/tour-rooms/${encodeURIComponent(bookingId)}/interpret`, {
          method: 'POST',
          headers: { 'x-tour-room-auth': roomSession },
          body: form,
        });
        if (!res.ok) throw new Error(`interpret ${res.status}`);
        const data = (await res.json()) as Omit<Turn, 'id' | 'side'>;

        if (!data.sourceText) {
          setError(copy.empty);
          return;
        }

        turnIdRef.current += 1;
        const turn: Turn = { id: turnIdRef.current, side, ...data };
        // 최신이 위로. 대면에서는 방금 한 말만 보면 된다 — 스크롤 대화록이 아니다.
        setTurns((prev) => [turn, ...prev].slice(0, MAX_TURNS));

        // 옮겨진 말을 상대 언어로 읽어준다. 기기에 그 음성이 없으면 조용히 넘어가고
        // 상대는 화면을 읽는다 — 자막이 1차 채널이라 그래도 통한다.
        // `to` 는 라우트가 돌려준 자유 문자열이라 UI 로케일로 좁혀서 넘긴다.
        if (turn.translatedText) void speakWithDevice(turn.translatedText, normalizeRoomLocale(turn.to));
      } catch {
        setError(copy.error);
      } finally {
        setBusySide(null);
      }
    },
    [bookingId, roomSession, guestLocale, copy.empty, copy.error],
  );

  const startRecording = useCallback(
    async (side: InterpretSide) => {
      if (recordingSide || busySide) return;
      // iOS 는 제스처 안에서 오디오를 한 번 풀어줘야 나중에 TTS 가 난다.
      primeAudio();
      setError(null);
      try {
        const mimeType = pickRecorderMimeType();
        if (!mimeType) throw new Error('unsupported');
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        chunksRef.current = [];
        const recorder = new MediaRecorder(stream, { mimeType });
        recorder.addEventListener('dataavailable', (event) => {
          if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
        });
        recorder.addEventListener('stop', () => {
          const blob = new Blob(chunksRef.current, { type: mimeType });
          chunksRef.current = [];
          stopTracks();
          if (blob.size > 0) void send(side, blob, mimeType);
        });
        recorder.start();
        recorderRef.current = recorder;
        setRecordingSide(side);
      } catch {
        stopTracks();
        setError(copy.error);
      }
    },
    [recordingSide, busySide, send, stopTracks, copy.error],
  );

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    recorderRef.current = null;
    setRecordingSide(null);
    if (recorder && recorder.state === 'recording') recorder.stop();
    else stopTracks();
  }, [stopTracks]);

  const latestFor = (side: InterpretSide): Turn | undefined => turns.find((turn) => turn.side !== side);

  return (
    <div className="tr-root flex h-[100dvh] flex-col bg-[var(--tr-canvas)] text-[var(--tr-ink)]">
      {/* 상대 면 — 180° 회전. 테이블 건너에서 읽는다. */}
      <Pane
        rotated
        side="local"
        prompt={copy.localPrompt}
        listening={copy.listening}
        working={copy.working}
        numbersWarning={copy.numbersWarning}
        turn={latestFor('local')}
        isRecording={recordingSide === 'local'}
        isBusy={busySide === 'local'}
        disabled={Boolean(recordingSide || busySide) && recordingSide !== 'local'}
        onStart={() => startRecording('local')}
        onStop={stopRecording}
      />

      <div className="relative h-px bg-[var(--tr-hairline)]">
        {error ? (
          <p
            role="status"
            className="text-cjk-body absolute left-1/2 top-1/2 w-[85%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--tr-danger)] px-4 py-1.5 text-center tr-meta text-[var(--tr-bubble-me-ink)]"
          >
            {error}
          </p>
        ) : null}
      </div>

      {/* 손님 면 — 정방향. */}
      <Pane
        side="guest"
        prompt={copy.guestPrompt}
        listening={copy.listening}
        working={copy.working}
        numbersWarning={copy.numbersWarning}
        turn={latestFor('guest')}
        isRecording={recordingSide === 'guest'}
        isBusy={busySide === 'guest'}
        disabled={Boolean(recordingSide || busySide) && recordingSide !== 'guest'}
        onStart={() => startRecording('guest')}
        onStop={stopRecording}
      />
    </div>
  );
}

interface PaneProps {
  side: InterpretSide;
  rotated?: boolean;
  prompt: string;
  listening: string;
  working: string;
  numbersWarning: string;
  turn?: Turn;
  isRecording: boolean;
  isBusy: boolean;
  disabled: boolean;
  onStart: () => void;
  onStop: () => void;
}

function Pane({
  side,
  rotated,
  prompt,
  listening,
  working,
  numbersWarning,
  turn,
  isRecording,
  isBusy,
  disabled,
  onStart,
  onStop,
}: PaneProps) {
  return (
    <section
      className="flex flex-1 flex-col items-center justify-center gap-4 px-5 py-6"
      style={rotated ? { transform: 'rotate(180deg)' } : undefined}
      data-testid={`interpret-pane-${side}`}
    >
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 text-center">
        {turn ? (
          <>
            {/* 이 면이 읽어야 할 것 = 상대가 한 말의 번역. 크게. */}
            <p className="text-cjk-body tr-display font-semibold leading-snug">{turn.translatedText}</p>
            {/* 원문은 작게 — 대조용이지 읽으라는 게 아니다. */}
            <p className="text-cjk-body tr-body text-[var(--tr-ink-2)]">{turn.sourceText}</p>
            {turn.droppedNumbers.length > 0 ? (
              <p
                role="alert"
                className="text-cjk-body tr-meta mt-1 rounded-lg bg-[var(--tr-danger-soft)] px-3 py-1.5 text-[var(--tr-ink)]"
              >
                {numbersWarning} <strong>{turn.droppedNumbers.join(' · ')}</strong>
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-cjk-body tr-body text-[var(--tr-ink-2)]">{prompt}</p>
        )}
      </div>

      <button
        type="button"
        // 누르고 있는 동안만 녹음. 상시 열린 마이크는 소음 환경에서 정확도를 무너뜨린다.
        onPointerDown={onStart}
        onPointerUp={onStop}
        onPointerCancel={onStop}
        onPointerLeave={isRecording ? onStop : undefined}
        disabled={disabled || isBusy}
        aria-label={prompt}
        data-testid={`interpret-mic-${side}`}
        className={`text-cjk-safe tr-btn h-16 w-full max-w-sm rounded-full tr-title font-semibold transition ${
          isRecording
            ? 'bg-[var(--tr-accent)] text-[var(--tr-bubble-me-ink)] scale-[0.98]'
            : 'bg-[var(--tr-surface)] text-[var(--tr-ink)]'
        } ${disabled || isBusy ? 'opacity-40' : ''}`}
      >
        {isBusy ? working : isRecording ? listening : prompt}
      </button>
    </section>
  );
}
