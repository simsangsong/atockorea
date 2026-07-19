'use client';

/**
 * Kakao-grade chat (Phase 2b) — the quoted reply snippet.
 *
 * Shared by two surfaces: the Composer's reply bar (variant 'bar', with a ✕ to
 * cancel) and the quote block above a bubble that replied to something
 * (variant 'bubble', tappable to jump to the original). Renders from the
 * server-built snapshot (kind + excerpt), localizing the sender label and the
 * "Photo / File / Voice" placeholder per viewer.
 */

import { IconClose, IconFile, IconListen, IconPhotoNote } from '@/components/tour-mode/icons';
import type { ReplySnapshot } from '@/lib/tour-room/reply';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

const ROLE_LABEL: Record<RoomLocale, Record<string, string>> = {
  en: { guide: 'Guide', driver: 'Driver', admin: 'AtoC Korea', customer: 'Guest', system: 'Notice' },
  ko: { guide: '가이드', driver: '기사님', admin: 'AtoC Korea', customer: '손님', system: '안내' },
  ja: { guide: 'ガイド', driver: 'ドライバー', admin: 'AtoC Korea', customer: 'ゲスト', system: 'お知らせ' },
  es: { guide: 'Guía', driver: 'Conductor', admin: 'AtoC Korea', customer: 'Huésped', system: 'Aviso' },
  zh: { guide: '导游', driver: '司机', admin: 'AtoC Korea', customer: '客人', system: '通知' },
};

const KIND_LABEL: Record<RoomLocale, { image: string; file: string; audio: string }> = {
  en: { image: 'Photo', file: 'File', audio: 'Voice message' },
  ko: { image: '사진', file: '파일', audio: '음성 메시지' },
  ja: { image: '写真', file: 'ファイル', audio: '音声メッセージ' },
  es: { image: 'Foto', file: 'Archivo', audio: 'Mensaje de voz' },
  zh: { image: '照片', file: '文件', audio: '语音消息' },
};

export default function ReplyPreview({
  snapshot,
  locale,
  variant,
  mine = false,
  onClose,
}: {
  snapshot: ReplySnapshot;
  locale: RoomLocale;
  variant: 'bar' | 'bubble';
  /** 'bubble' variant only: tint for my-bubble vs incoming. */
  mine?: boolean;
  onClose?: () => void;
}) {
  const roleLabel = ROLE_LABEL[locale]?.[snapshot.sender_role] ?? snapshot.sender_role;
  const kinds = KIND_LABEL[locale] ?? KIND_LABEL.en;
  const KindIcon =
    snapshot.input_kind === 'image' ? IconPhotoNote : snapshot.input_kind === 'file' ? IconFile : snapshot.input_kind === 'audio' ? IconListen : null;
  const body =
    snapshot.excerpt ||
    (snapshot.input_kind === 'image'
      ? kinds.image
      : snapshot.input_kind === 'file'
        ? snapshot.file_name || kinds.file
        : snapshot.input_kind === 'audio'
          ? kinds.audio
          : '');

  if (variant === 'bar') {
    return (
      <div className="tr-card mx-3 mb-1.5 flex items-center gap-2 p-2.5" data-testid="reply-bar">
        <div className="min-w-0 flex-1 border-l-2 border-[var(--tr-accent)] pl-2.5">
          <p className="tr-meta font-bold text-[var(--tr-accent-deep)]">{roleLabel}</p>
          <p className="tr-label flex items-center gap-1 truncate text-[var(--tr-ink-2)]">
            {KindIcon && <KindIcon size={12} aria-hidden />}
            {body}
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="cancel reply"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--tr-ink-2)]"
            data-testid="reply-cancel"
          >
            <IconClose size={16} />
          </button>
        )}
      </div>
    );
  }

  // 'bubble' — the quote block sitting above the bubble that replied.
  return (
    <div
      className={`mb-0.5 max-w-full rounded-t-[var(--tr-radius-bubble)] border-l-2 border-[var(--tr-accent)] px-2.5 py-1 ${
        mine ? 'bg-black/5' : 'bg-[var(--tr-surface-2)]'
      }`}
      data-testid="reply-snippet"
    >
      <p className="tr-meta font-bold text-[var(--tr-accent-deep)]">{roleLabel}</p>
      <p className="tr-meta flex items-center gap-1 truncate text-[var(--tr-ink-3)]">
        {KindIcon && <KindIcon size={11} aria-hidden />}
        {body}
      </p>
    </div>
  );
}
