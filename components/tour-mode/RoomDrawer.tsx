'use client';

/**
 * U4-D5 — the room drawer (카톡 채팅방 서랍 문법).
 *
 * KakaoTalk's room drawer collects 사진/동영상·파일·링크, the feature grid and
 * the member list behind the header ☰. Ours does the same for a tour room:
 *
 *   ① 모아보기 — image strip / file list / link list, read from the chat
 *      itself via GET /api/tour-rooms/[bookingId]/media (no new tables).
 *   ② 바로가기 — schedule/map/settings tabs, Smart Guide, emergency.
 *   ③ 대화상대 — everyone in the room with their role.
 *
 * Right-slide panel, room-token auth (`x-tour-room-auth`), 5-locale labels.
 * Guests and staff share it; entries that need a role hide themselves.
 */

import { useCallback, useEffect, useState } from 'react';
import Avatar from '@/components/tour-mode/Avatar';
import Lightbox from '@/components/tour-mode/Lightbox';
import type { DrawerAttachmentItem, DrawerLinkItem } from '@/lib/tour-room/drawer';
import type { RoomLocale } from '@/lib/tour-room/snapshot';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { useTourRoomSettings } from '@/hooks/useTourRoomSettings';
import {
  IconClose,
  IconEmergency,
  IconFile,
  IconInstall,
  IconLink,
  IconOpenExternal,
  IconTabMap,
  IconTabSchedule,
  IconTabSettings,
  IconThemeDark,
  IconThemeLight,
  IconThemeSystem,
  TR_ICON,
  TR_STROKE,
} from '@/components/tour-mode/icons';

const COPY: Record<
  RoomLocale,
  {
    media: string;
    files: string;
    links: string;
    shortcuts: string;
    members: string;
    /** Marks the viewer in the member list. */
    me: string;
    empty: string;
    /** T3 — keyset pagination: fetch the next page of a media kind. */
    more: string;
    /** §5-3 (2026-08-04) — in-room chat search. */
    search: string;
    schedule: string;
    map: string;
    settings: string;
    emergency: string;
    close: string;
    /** C-D1 — the theme control moved out of the header into this tile. */
    display: { light: string; dark: string; system: string };
    /** T-D2 — the PWA install tile (hidden when no install path exists). */
    install: string;
    roles: Record<string, string>;
  }
> = {
  en: {
    media: 'Photos & videos',
    files: 'Files',
    links: 'Links',
    shortcuts: 'Shortcuts',
    members: 'Members',
    me: '(you)',
    empty: 'Nothing here yet',
    more: 'More',
    search: 'Search chat',
    schedule: 'Today',
    map: 'Map',
    settings: 'Settings',
    emergency: 'Emergency',
    close: 'Close',
    display: { light: 'Light', dark: 'Dark', system: 'Auto' },
    install: 'Install app',
    roles: { guide: 'Guide', driver: 'Driver', admin: 'AtoC Korea', customer: 'Traveller' },
  },
  ko: {
    media: '사진/동영상',
    files: '파일',
    links: '링크',
    shortcuts: '바로가기',
    members: '대화상대',
    me: '(나)',
    empty: '아직 없어요',
    more: '더 보기',
    search: '대화 검색',
    schedule: '오늘 일정',
    map: '지도',
    settings: '설정',
    emergency: '긴급',
    close: '닫기',
    display: { light: '라이트', dark: '다크', system: '자동' },
    install: '앱 설치',
    roles: { guide: '가이드', driver: '기사님', admin: 'AtoC Korea', customer: '여행자' },
  },
  ja: {
    media: '写真/動画',
    files: 'ファイル',
    links: 'リンク',
    shortcuts: 'ショートカット',
    members: 'メンバー',
    me: '(自分)',
    empty: 'まだありません',
    more: 'もっと見る',
    search: 'チャット検索',
    schedule: '本日',
    map: '地図',
    settings: '設定',
    emergency: '緊急',
    close: '閉じる',
    display: { light: 'ライト', dark: 'ダーク', system: '自動' },
    install: 'アプリ追加',
    roles: { guide: 'ガイド', driver: 'ドライバー', admin: 'AtoC Korea', customer: '旅行者' },
  },
  es: {
    media: 'Fotos y vídeos',
    files: 'Archivos',
    links: 'Enlaces',
    shortcuts: 'Accesos directos',
    members: 'Miembros',
    me: '(tú)',
    empty: 'Aún no hay nada',
    more: 'Ver más',
    search: 'Buscar en el chat',
    schedule: 'Hoy',
    map: 'Mapa',
    settings: 'Ajustes',
    emergency: 'Emergencia',
    close: 'Cerrar',
    display: { light: 'Claro', dark: 'Oscuro', system: 'Auto' },
    install: 'Instalar app',
    roles: { guide: 'Guía', driver: 'Conductor', admin: 'AtoC Korea', customer: 'Viajero' },
  },
  zh: {
    media: '照片/视频',
    files: '文件',
    links: '链接',
    shortcuts: '快捷方式',
    members: '成员',
    me: '(我)',
    empty: '暂时没有内容',
    more: '查看更多',
    search: '搜索聊天',
    schedule: '今日',
    map: '地图',
    settings: '设置',
    emergency: '紧急',
    close: '关闭',
    display: { light: '浅色', dark: '深色', system: '自动' },
    install: '安装应用',
    roles: { guide: '导游', driver: '司机', admin: 'AtoC Korea', customer: '旅客' },
  },
  'zh-TW': {
    media: '照片/影片',
    files: '檔案',
    links: '連結',
    shortcuts: '捷徑',
    members: '成員',
    me: '(我)',
    empty: '目前還沒有內容',
    more: '查看更多',
    search: '搜尋聊天',
    schedule: '今日',
    map: '地圖',
    settings: '設定',
    emergency: '緊急',
    close: '關閉',
    display: { light: '淺色', dark: '深色', system: '自動' },
    install: '安裝 App',
    roles: { guide: '導遊', driver: '司機', admin: 'AtoC Korea', customer: '旅客' },
  },
  fr: {
    media: 'Photos et vidéos',
    files: 'Fichiers',
    links: 'Liens',
    shortcuts: 'Raccourcis',
    members: 'Membres',
    me: '(vous)',
    empty: 'Rien pour l’instant',
    more: 'Voir plus',
    search: 'Rechercher dans le chat',
    schedule: 'Aujourd’hui',
    map: 'Carte',
    settings: 'Réglages',
    emergency: 'Urgence',
    close: 'Fermer',
    display: { light: 'Clair', dark: 'Sombre', system: 'Auto' },
    install: 'Installer l’app',
    roles: { guide: 'Guide', driver: 'Chauffeur', admin: 'AtoC Korea', customer: 'Voyageur' },
  },
  de: {
    media: 'Fotos & Videos',
    files: 'Dateien',
    links: 'Links',
    shortcuts: 'Schnellzugriff',
    members: 'Mitglieder',
    me: '(Sie)',
    empty: 'Noch nichts da',
    more: 'Mehr anzeigen',
    search: 'Chat durchsuchen',
    schedule: 'Heute',
    map: 'Karte',
    settings: 'Einstellungen',
    emergency: 'Notfall',
    close: 'Schließen',
    display: { light: 'Hell', dark: 'Dunkel', system: 'Auto' },
    install: 'App installieren',
    roles: { guide: 'Guide', driver: 'Fahrer', admin: 'AtoC Korea', customer: 'Reisender' },
  },
  ru: {
    media: 'Фото и видео',
    files: 'Файлы',
    links: 'Ссылки',
    shortcuts: 'Быстрый доступ',
    members: 'Участники',
    me: '(вы)',
    empty: 'Пока пусто',
    more: 'Ещё',
    search: 'Поиск в чате',
    schedule: 'Сегодня',
    map: 'Карта',
    settings: 'Настройки',
    emergency: 'SOS',
    close: 'Закрыть',
    display: { light: 'Светлая', dark: 'Темная', system: 'Авто' },
    install: 'Установить',
    roles: { guide: 'Гид', driver: 'Водитель', admin: 'AtoC Korea', customer: 'Путешественник' },
  },
  it: {
    media: 'Foto e video',
    files: 'File',
    links: 'Link',
    shortcuts: 'Scorciatoie',
    members: 'Membri',
    me: '(tu)',
    empty: 'Ancora niente qui',
    more: 'Mostra altro',
    search: 'Cerca nella chat',
    schedule: 'Oggi',
    map: 'Mappa',
    settings: 'Impostazioni',
    emergency: 'Emergenza',
    close: 'Chiudi',
    display: { light: 'Chiaro', dark: 'Scuro', system: 'Auto' },
    install: 'Installa l’app',
    roles: { guide: 'Guida', driver: 'Autista', admin: 'AtoC Korea', customer: 'Viaggiatore' },
  },
};

interface DrawerParticipant {
  id?: string;
  role: string;
  display_name: string;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export default function RoomDrawer({
  title,
  locale,
  bookingId,
  roomSession,
  participants,
  myParticipantId,
  messages,
  onJumpToMessage,
  onClose,
  onSelectTab,
  onOpenEmergency,
}: {
  title: string;
  locale: RoomLocale;
  bookingId: string;
  roomSession: string;
  participants: DrawerParticipant[];
  /**
   * The viewer's own participant row. Without it the member list was N
   * identical rows all labelled by role — on a bus of twelve, a guest could
   * not find themselves in the list of who is here.
   */
  myParticipantId?: string | null;
  /** §5-3 — the loaded feed, searched in place; absent = no search section. */
  messages?: Array<{ id: string; created_at: string; source_text: string; translations?: Record<string, string> | null; metadata?: Record<string, unknown> | null }>;
  /** §5-3 — jump the chat to a message (reuses the focusMessageId engine). */
  onJumpToMessage?: (id: string) => void;
  onClose: () => void;
  onSelectTab: (tab: 'schedule' | 'map' | 'settings') => void;
  onOpenEmergency: () => void;
}) {
  const copy = COPY[locale] ?? COPY.en;
  // C-D1 — the header lost its theme button in the icon diet; the drawer tile
  // is the quick control now (Settings tab keeps the full segmented one).
  // Cycling must NOT close the drawer: the user is previewing looks.
  const { settings: deviceSettings, update: updateSettings } = useTourRoomSettings();
  // T-D2 — install tile: native mode prompts in place (dialog overlays the
  // drawer); iOS mode routes to Settings, where the install card (top zone)
  // carries the share-sheet steps.
  const { mode: installMode, promptInstall } = useInstallPrompt();
  const themeCycle = { light: 'dark', dark: 'system', system: 'light' } as const;
  const ThemeIcon =
    deviceSettings.theme === 'light'
      ? IconThemeLight
      : deviceSettings.theme === 'dark'
        ? IconThemeDark
        : IconThemeSystem;
  const [images, setImages] = useState<DrawerAttachmentItem[] | null>(null);
  const [files, setFiles] = useState<DrawerAttachmentItem[] | null>(null);
  const [links, setLinks] = useState<DrawerLinkItem[] | null>(null);
  const [lightbox, setLightbox] = useState<{ url: string; name?: string | null } | null>(null);
  // 적대적 리뷰 #3 — 만료 세션의 403이 "아직 없어요"로 위장되면 안 된다.
  const [authExpired, setAuthExpired] = useState(false);
  /**
   * T3 (§O ⑥) — the media route has been keyset-paginated since U4-D5
   * (`?cursor=` in, `nextCursor` out) and the drawer never sent the cursor:
   * the engine existed with no caller, so a room's 31st photo was simply
   * unreachable. A non-null cursor renders a "more" affordance per kind.
   */
  const [cursors, setCursors] = useState<Record<'image' | 'file' | 'link', string | null>>({
    image: null,
    file: null,
    link: null,
  });
  const [busyKind, setBusyKind] = useState<'image' | 'file' | 'link' | null>(null);
  /** §5-3 — in-memory search over the loaded feed (tombstones excluded). */
  const [query, setQuery] = useState('');
  const queryTrim = query.trim().toLowerCase();
  const searchHits =
    messages && queryTrim.length >= 2
      ? messages
          .filter((m) => (m.metadata as { deleted?: unknown } | null)?.deleted !== true)
          .filter((m) => {
            const hay = [m.source_text ?? '', ...Object.values(m.translations ?? {})].join('\n').toLowerCase();
            return hay.includes(queryTrim);
          })
          .slice(-20)
          .reverse()
      : [];

  const fetchKind = useCallback(
    async (kind: 'image' | 'file' | 'link', cursor?: string) => {
      const empty = { items: [] as unknown[], nextCursor: null as string | null };
      try {
        const qs = cursor ? `&cursor=${encodeURIComponent(cursor)}` : '';
        const res = await fetch(`/api/tour-rooms/${bookingId}/media?kind=${kind}${qs}`, {
          headers: { 'x-tour-room-auth': roomSession },
          cache: 'no-store',
        });
        if (res.status === 401 || res.status === 403) {
          setAuthExpired(true);
          return empty;
        }
        const json = await res.json();
        return res.ok ? { items: json.items ?? [], nextCursor: json.nextCursor ?? null } : empty;
      } catch {
        return empty;
      }
    },
    [bookingId, roomSession],
  );

  useEffect(() => {
    let alive = true;
    void Promise.all([fetchKind('image'), fetchKind('file'), fetchKind('link')]).then(
      ([img, fil, lnk]) => {
        if (!alive) return;
        setImages(img.items as DrawerAttachmentItem[]);
        setFiles(fil.items as DrawerAttachmentItem[]);
        setLinks(lnk.items as DrawerLinkItem[]);
        setCursors({ image: img.nextCursor, file: fil.nextCursor, link: lnk.nextCursor });
      },
    );
    return () => {
      alive = false;
    };
  }, [fetchKind]);

  const loadMore = useCallback(
    async (kind: 'image' | 'file' | 'link') => {
      const cursor = cursors[kind];
      if (!cursor || busyKind) return;
      setBusyKind(kind);
      const page = await fetchKind(kind, cursor);
      if (kind === 'image') setImages((prev) => [...(prev ?? []), ...(page.items as DrawerAttachmentItem[])]);
      else if (kind === 'file') setFiles((prev) => [...(prev ?? []), ...(page.items as DrawerAttachmentItem[])]);
      else setLinks((prev) => [...(prev ?? []), ...(page.items as DrawerLinkItem[])]);
      setCursors((prev) => ({ ...prev, [kind]: page.nextCursor }));
      setBusyKind(null);
    },
    [busyKind, cursors, fetchKind],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const shortcuts: Array<{
    key: string;
    label: string;
    Icon: typeof IconTabSchedule;
    onPress: () => void;
    danger?: boolean;
  }> = [
    /**
     * 🔴 Today · Map · Settings · Smart Guide came out (owner's call,
     * 2026-07-28). Every one of them was already ONE tap away — three on the
     * tab bar directly below, the Smart Guide on the header of every tab and
     * in the composer tray. Reaching them by opening a drawer and tapping a
     * tile is strictly two taps for the same destination, and six tiles that
     * mostly go nowhere new made the drawer read as a second, competing
     * navigation. The drawer is now what only it can be: what the room
     * CONTAINS (photos, files, links, who is here) plus the two device
     * controls that genuinely live nowhere else.
     *
     * Emergency stays. Navigational redundancy is clutter; safety redundancy
     * is not — a second door to the SOS sheet costs one tile and is worth it.
     */
    { key: 'emergency', label: copy.emergency, Icon: IconEmergency, onPress: onOpenEmergency, danger: true },
  ];

  const sectionLabel = 'tr-label text-cjk-safe font-bold uppercase tracking-wide text-[var(--tr-ink-3)]';

  return (
    <div className="fixed inset-0 z-50" data-testid="room-drawer">
      <button type="button" aria-label={copy.close} className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside
        className="absolute bottom-0 right-0 top-0 flex w-[85%] max-w-[340px] flex-col bg-[var(--tr-canvas)] shadow-[var(--tr-shadow-overlay)]"
        style={{ animation: 'tr-drawer-in var(--tr-dur-base) var(--tr-ease-out)' }}
      >
        <style>{`
          @keyframes tr-drawer-in { from { transform: translateX(24px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
          @media (prefers-reduced-motion: reduce) { [data-testid='room-drawer'] aside { animation: none !important; } }
        `}</style>

        <div className="tr-safe-top tr-chrome-line-b flex shrink-0 items-center gap-2 bg-[var(--tr-chrome)] px-4" style={{ minHeight: 'var(--tr-header-h)' }}>
          {/* UX-005 — the one place a guest can read the whole tour name.
              Every other surface truncates it (room header, staff shell,
              cockpit, chat list), and truncating is right for those: they are
              chrome competing with icon rows. But that left the full title
              readable nowhere, and the guest is the one person who does not
              already know which tour they are on.
              The drawer is the detail surface and its header is min-height,
              not fixed, so dropping `truncate` lets it grow instead of
              clipping. Capped at three lines, which holds every title in the
              catalogue at this width. */}
          <p className="tr-title line-clamp-3 min-w-0 flex-1 text-[var(--tr-ink)]">{title}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label={copy.close}
            className="flex h-11 w-10 items-center justify-center rounded-full text-[var(--tr-ink-2)] active:bg-[var(--tr-surface-2)]"
            data-testid="drawer-close"
          >
            <IconClose size={TR_ICON.nav} strokeWidth={TR_STROKE.default} aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
          {authExpired && (
            <p
              className="tr-label rounded-xl bg-[var(--tr-danger-soft)] px-3 py-2 font-medium text-[var(--tr-danger)]"
              data-testid="drawer-auth-expired"
            >
              {locale === 'ko'
                ? '세션이 만료됐어요 — 초대 링크로 방을 다시 열어주세요.'
                : locale === 'ja'
                  ? 'セッションが切れました — 招待リンクからもう一度開いてください。'
                  : locale === 'es'
                    ? 'La sesión expiró: vuelve a abrir la sala desde tu enlace.'
                    : locale === 'zh'
                      ? '会话已过期 — 请通过邀请链接重新打开房间。'
                      : locale === 'zh-TW'
                        ? '登入狀態已過期——請透過邀請連結重新開啟房間。'
                        : locale === 'fr'
                        ? 'Session expirée — rouvrez l’espace tour depuis votre lien d’invitation.'
                        : locale === 'de'
                          ? 'Sitzung abgelaufen — öffnen Sie den Tour-Raum erneut über Ihren Einladungslink.'
                          : locale === 'ru'
                            ? 'Сессия истекла — откройте комнату заново по ссылке-приглашению.'
                            : locale === 'it'
                              ? 'Sessione scaduta — riapri la stanza dal tuo link d’invito.'
                              : 'Session expired — reopen the room from your invite link.'}
            </p>
          )}
          {/* §5-3 — 대화 검색 (불러온 대화 안에서, 탭하면 그 메시지로 점프) */}
          {messages && onJumpToMessage ? (
            <section>
              <h3 className={sectionLabel}>{copy.search}</h3>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={copy.search}
                className="tr-body mt-2 w-full rounded-xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-3 py-2.5 text-[var(--tr-ink)]"
                data-testid="drawer-search-input"
              />
              {queryTrim.length >= 2 ? (
                searchHits.length === 0 ? (
                  <p className="tr-meta mt-2 text-[var(--tr-ink-3)]">{copy.empty}</p>
                ) : (
                  <div className="mt-2 space-y-1" data-testid="drawer-search-results">
                    {searchHits.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => onJumpToMessage(m.id)}
                        className="text-cjk-body flex w-full items-center gap-2 rounded-xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-3 py-2 text-left"
                        data-testid="drawer-search-hit"
                      >
                        <span className="tr-card-text text-cjk-safe min-w-0 flex-1 text-[var(--tr-ink)]">
                          {(m.source_text || Object.values(m.translations ?? {})[0] || '').slice(0, 60)}
                        </span>
                        <span className="tr-meta tr-num shrink-0 text-[var(--tr-ink-3)]">
                          {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </button>
                    ))}
                  </div>
                )
              ) : null}
            </section>
          ) : null}

          {/* ① 모아보기 — 사진/동영상 */}
          <section className={images !== null && images.length === 0 ? 'hidden' : undefined}>
            <h3 className={sectionLabel}>{copy.media}</h3>
            {images === null ? (
              <div className="tr-skeleton mt-2 h-20 rounded-xl" />
            ) : images.length === 0 ? (
              <p className="tr-meta mt-2 text-[var(--tr-ink-3)]">{copy.empty}</p>
            ) : (
              <div className="tr-chiprow mt-2 flex gap-1.5 pb-1" data-testid="drawer-images">
                {images.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setLightbox({ url: item.url, name: item.name })}
                    className="tr-press h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-[var(--tr-surface-2)]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.url} alt={item.name ?? ''} loading="lazy" className="h-full w-full object-cover" />
                  </button>
                ))}
                {cursors.image && (
                  <button
                    type="button"
                    disabled={busyKind !== null}
                    onClick={() => void loadMore('image')}
                    className="tr-press text-cjk-safe flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)]"
                    data-testid="drawer-images-more"
                  >
                    {busyKind === 'image' ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--tr-accent)] border-t-transparent" aria-hidden />
                    ) : (
                      <span className="tr-label text-[var(--tr-ink-2)]">{copy.more}</span>
                    )}
                  </button>
                )}
              </div>
            )}
          </section>

          {/* ① 모아보기 — 파일 */}
          <section className={files !== null && files.length === 0 ? 'hidden' : undefined}>
            <h3 className={sectionLabel}>{copy.files}</h3>
            {files === null ? (
              <div className="tr-skeleton mt-2 h-12 rounded-xl" />
            ) : files.length === 0 ? (
              <p className="tr-meta mt-2 text-[var(--tr-ink-3)]">{copy.empty}</p>
            ) : (
              <div className="mt-2 space-y-1" data-testid="drawer-files">
                {files.map((item) => (
                  <a
                    key={item.id}
                    href={item.url}
                    download={item.name ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="tr-card flex min-h-[48px] items-center gap-2.5 border border-[var(--tr-hairline)] px-3"
                  >
                    <IconFile size={TR_ICON.action} className="shrink-0 text-[var(--tr-ink-2)]" aria-hidden />
                    <span className="tr-card-text min-w-0 flex-1 truncate font-medium text-[var(--tr-ink)]">
                      {item.name ?? 'file'}
                    </span>
                    <IconInstall size={TR_ICON.chip} className="shrink-0 text-[var(--tr-ink-3)]" aria-hidden />
                  </a>
                ))}
                {cursors.file && (
                  <button
                    type="button"
                    disabled={busyKind !== null}
                    onClick={() => void loadMore('file')}
                    className="tr-press text-cjk-safe flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)]"
                    data-testid="drawer-files-more"
                  >
                    {busyKind === 'file' ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--tr-accent)] border-t-transparent" aria-hidden />
                    ) : (
                      <span className="tr-label text-[var(--tr-ink-2)]">{copy.more}</span>
                    )}
                  </button>
                )}
              </div>
            )}
          </section>

          {/* ① 모아보기 — 링크 */}
          <section className={links !== null && links.length === 0 ? 'hidden' : undefined}>
            <h3 className={sectionLabel}>{copy.links}</h3>
            {links === null ? (
              <div className="tr-skeleton mt-2 h-12 rounded-xl" />
            ) : links.length === 0 ? (
              <p className="tr-meta mt-2 text-[var(--tr-ink-3)]">{copy.empty}</p>
            ) : (
              <div className="mt-2 space-y-1" data-testid="drawer-links">
                {links.map((item, i) => (
                  <a
                    key={`${item.id}-${i}`}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="tr-card flex min-h-[48px] items-center gap-2.5 border border-[var(--tr-hairline)] px-3"
                  >
                    <IconLink size={TR_ICON.action} className="shrink-0 text-[var(--tr-ink-2)]" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="tr-card-text block truncate font-medium text-[var(--tr-ink)]">{hostOf(item.url)}</span>
                      <span className="tr-meta block truncate text-[var(--tr-ink-3)]">{item.url}</span>
                    </span>
                    <IconOpenExternal size={TR_ICON.chip} className="shrink-0 text-[var(--tr-ink-3)]" aria-hidden />
                  </a>
                ))}
                {cursors.link && (
                  <button
                    type="button"
                    disabled={busyKind !== null}
                    onClick={() => void loadMore('link')}
                    className="tr-press text-cjk-safe flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)]"
                    data-testid="drawer-links-more"
                  >
                    {busyKind === 'link' ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--tr-accent)] border-t-transparent" aria-hidden />
                    ) : (
                      <span className="tr-label text-[var(--tr-ink-2)]">{copy.more}</span>
                    )}
                  </button>
                )}
              </div>
            )}
          </section>

          {/* ② 바로가기 */}
          <section>
            <h3 className={sectionLabel}>{copy.shortcuts}</h3>
            <div className="mt-2 grid grid-cols-3 gap-1.5" data-testid="drawer-shortcuts">
              {shortcuts.map(({ key, label, Icon, onPress, danger }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    onClose();
                    onPress();
                  }}
                  data-testid={`drawer-shortcut-${key}`}
                  className="tr-home-card tr-press flex min-h-[68px] flex-col items-center justify-center gap-1.5 px-1 py-2"
                >
                  <span
                    className={`tr-chip relative flex h-10 w-10 items-center justify-center !rounded-[13px] ${
                      danger ? 'tr-chip--danger' : 'tr-chip--base'
                    }`}
                  >
                    <Icon size={TR_ICON.action} strokeWidth={TR_STROKE.default} aria-hidden />
                  </span>
                  <span className="tr-meta text-cjk-safe max-w-full font-medium text-[var(--tr-ink)]">{label}</span>
                </button>
              ))}
              {/* 화면 모드 — cycles in place (no onClose): the whole point is
                  seeing the room change behind the drawer. */}
              <button
                type="button"
                onClick={() => updateSettings({ theme: themeCycle[deviceSettings.theme] })}
                data-testid="drawer-theme-tile"
                aria-label={`${copy.settings} · ${copy.display[deviceSettings.theme]}`}
                className="tr-home-card tr-press flex min-h-[68px] flex-col items-center justify-center gap-1.5 px-1 py-2"
              >
                <span className="tr-chip tr-chip--accent relative flex h-10 w-10 items-center justify-center !rounded-[13px]">
                  <ThemeIcon size={TR_ICON.action} strokeWidth={TR_STROKE.default} aria-hidden />
                </span>
                <span className="tr-meta text-cjk-safe max-w-full font-medium text-[var(--tr-ink)]">
                  {copy.display[deviceSettings.theme]}
                </span>
              </button>
              {installMode !== 'unavailable' && (
                <button
                  type="button"
                  onClick={() => {
                    if (installMode === 'native') {
                      void promptInstall();
                    } else {
                      onClose();
                      onSelectTab('settings');
                    }
                  }}
                  data-testid="drawer-install-tile"
                  className="tr-home-card tr-press flex min-h-[68px] flex-col items-center justify-center gap-1.5 px-1 py-2"
                >
                  <span className="tr-chip tr-chip--accent relative flex h-10 w-10 items-center justify-center !rounded-[13px]">
                    <IconInstall size={TR_ICON.action} strokeWidth={TR_STROKE.default} aria-hidden />
                  </span>
                  <span className="tr-meta text-cjk-safe max-w-full font-medium text-[var(--tr-ink)]">
                    {copy.install}
                  </span>
                </button>
              )}
            </div>
          </section>

          {/* ③ 대화상대 */}
          <section>
            <h3 className={sectionLabel}>
              {copy.members} · {participants.length}
            </h3>
            <div className="mt-2 space-y-0.5" data-testid="drawer-members">
              {participants.map((p, i) => {
                const isMe = Boolean(myParticipantId && p.id && p.id === myParticipantId);
                return (
                  <div
                    key={`${p.role}-${p.display_name}-${i}`}
                    className={`flex min-h-[48px] items-center gap-2.5 ${isMe ? 'rounded-xl bg-[var(--tr-accent-soft)] px-2' : ''}`}
                    data-testid={isMe ? 'drawer-member-me' : undefined}
                  >
                    <Avatar role={p.role} size={34} />
                    <span className="tr-card-text min-w-0 flex-1 truncate font-medium text-[var(--tr-ink)]">
                      {p.display_name}
                      {isMe && (
                        <span className="tr-meta text-cjk-safe ml-1.5 font-bold text-[var(--tr-accent-deep)]">
                          {copy.me}
                        </span>
                      )}
                    </span>
                    <span className="tr-meta text-cjk-safe shrink-0 rounded-full bg-[var(--tr-surface-2)] px-2 py-0.5 font-semibold text-[var(--tr-ink-2)]">
                      {copy.roles[p.role] ?? p.role}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </aside>

      <Lightbox url={lightbox?.url ?? null} name={lightbox?.name} locale={locale} onClose={() => setLightbox(null)} />
    </div>
  );
}
