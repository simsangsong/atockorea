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
  IconConcierge,
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
    empty: string;
    schedule: string;
    map: string;
    settings: string;
    concierge: string;
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
    empty: 'Nothing here yet',
    schedule: 'Today',
    map: 'Map',
    settings: 'Settings',
    concierge: 'Smart Guide',
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
    empty: '아직 없어요',
    schedule: '오늘 일정',
    map: '지도',
    settings: '설정',
    concierge: '스마트 가이드',
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
    empty: 'まだありません',
    schedule: '本日',
    map: '地図',
    settings: '設定',
    concierge: 'スマートガイド',
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
    empty: 'Aún no hay nada',
    schedule: 'Hoy',
    map: 'Mapa',
    settings: 'Ajustes',
    concierge: 'Guía inteligente',
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
    empty: '暂时没有内容',
    schedule: '今日',
    map: '地图',
    settings: '设置',
    concierge: '智能向导',
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
    empty: '目前還沒有內容',
    schedule: '今日',
    map: '地圖',
    settings: '設定',
    concierge: '智慧導覽',
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
    empty: 'Rien pour l’instant',
    schedule: 'Aujourd’hui',
    map: 'Carte',
    settings: 'Réglages',
    concierge: 'Guide intelligent',
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
    empty: 'Noch nichts da',
    schedule: 'Heute',
    map: 'Karte',
    settings: 'Einstellungen',
    concierge: 'Smart Guide',
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
    empty: 'Пока пусто',
    schedule: 'Сегодня',
    map: 'Карта',
    settings: 'Настройки',
    concierge: 'Умный гид',
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
    empty: 'Ancora niente qui',
    schedule: 'Oggi',
    map: 'Mappa',
    settings: 'Impostazioni',
    concierge: 'Guida smart',
    emergency: 'Emergenza',
    close: 'Chiudi',
    display: { light: 'Chiaro', dark: 'Scuro', system: 'Auto' },
    install: 'Installa l’app',
    roles: { guide: 'Guida', driver: 'Autista', admin: 'AtoC Korea', customer: 'Viaggiatore' },
  },
};

interface DrawerParticipant {
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
  onClose,
  onSelectTab,
  onOpenConcierge,
  onOpenEmergency,
}: {
  title: string;
  locale: RoomLocale;
  bookingId: string;
  roomSession: string;
  participants: DrawerParticipant[];
  onClose: () => void;
  onSelectTab: (tab: 'schedule' | 'map' | 'settings') => void;
  onOpenConcierge?: () => void;
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

  const fetchKind = useCallback(
    async (kind: 'image' | 'file' | 'link') => {
      try {
        const res = await fetch(`/api/tour-rooms/${bookingId}/media?kind=${kind}`, {
          headers: { 'x-tour-room-auth': roomSession },
          cache: 'no-store',
        });
        if (res.status === 401 || res.status === 403) {
          setAuthExpired(true);
          return [];
        }
        const json = await res.json();
        return res.ok ? (json.items ?? []) : [];
      } catch {
        return [];
      }
    },
    [bookingId, roomSession],
  );

  useEffect(() => {
    let alive = true;
    void Promise.all([fetchKind('image'), fetchKind('file'), fetchKind('link')]).then(
      ([img, fil, lnk]) => {
        if (!alive) return;
        setImages(img as DrawerAttachmentItem[]);
        setFiles(fil as DrawerAttachmentItem[]);
        setLinks(lnk as DrawerLinkItem[]);
      },
    );
    return () => {
      alive = false;
    };
  }, [fetchKind]);

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
    { key: 'schedule', label: copy.schedule, Icon: IconTabSchedule, onPress: () => onSelectTab('schedule') },
    { key: 'map', label: copy.map, Icon: IconTabMap, onPress: () => onSelectTab('map') },
    { key: 'settings', label: copy.settings, Icon: IconTabSettings, onPress: () => onSelectTab('settings') },
    ...(onOpenConcierge
      ? [{ key: 'concierge', label: copy.concierge, Icon: IconConcierge, onPress: onOpenConcierge }]
      : []),
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
          <p className="tr-title min-w-0 flex-1 truncate text-[var(--tr-ink)]">{title}</p>
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
          {/* ① 모아보기 — 사진/동영상 */}
          <section>
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
              </div>
            )}
          </section>

          {/* ① 모아보기 — 파일 */}
          <section>
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
              </div>
            )}
          </section>

          {/* ① 모아보기 — 링크 */}
          <section>
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
              {participants.map((p, i) => (
                <div key={`${p.role}-${p.display_name}-${i}`} className="flex min-h-[48px] items-center gap-2.5">
                  <Avatar role={p.role} size={34} />
                  <span className="tr-card-text min-w-0 flex-1 truncate font-medium text-[var(--tr-ink)]">
                    {p.display_name}
                  </span>
                  <span className="tr-meta text-cjk-safe shrink-0 rounded-full bg-[var(--tr-surface-2)] px-2 py-0.5 font-semibold text-[var(--tr-ink-2)]">
                    {copy.roles[p.role] ?? p.role}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </aside>

      <Lightbox url={lightbox?.url ?? null} name={lightbox?.name} locale={locale} onClose={() => setLightbox(null)} />
    </div>
  );
}
