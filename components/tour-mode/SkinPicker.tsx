'use client';

/**
 * C-D6 (docs/smartapp-chat-ui-theme-master-plan-2026-07-27.md) — the
 * background-theme picker, KakaoTalk theme-store grammar in miniature: each
 * option is a swatch card showing the skin's chat canvas with an incoming +
 * outgoing bubble pair, so the guest previews the LOOK, not a color name.
 *
 * Swatches are the skins' light-variant colors on purpose: they are stable
 * little posters (the room behind updates live in the current theme anyway),
 * and a dark-variant swatch grid reads as six near-black squares.
 *
 * Device-scoped via useTourRoomSettings.skin; applies instantly (data-tr-skin
 * on the shell root). No text inside the swatch — type discipline untouched.
 */

import { useTourRoomSettings, TOUR_SKINS, type TourSkin } from '@/hooks/useTourRoomSettings';
import type { RoomLocale } from '@/lib/tour-room/snapshot';
import { IconDone, TR_ICON } from '@/components/tour-mode/icons';

const SKIN_NAME: Record<RoomLocale, Record<TourSkin, string>> = {
  en: {
    classic: 'Classic',
    sky: 'Sky',
    winter: 'Winter',
    forest: 'Forest',
    meadow: 'Meadow',
    jeju: 'Jeju',
    seoul: 'Seoul',
    busan: 'Busan',
    blossom: 'Blossom',
    contrast: 'High contrast',
  },
  ko: {
    classic: '기본',
    sky: '하늘',
    winter: '겨울',
    forest: '숲',
    meadow: '들녘',
    jeju: '제주',
    seoul: '서울',
    busan: '부산',
    blossom: '벚꽃',
    contrast: '고대비',
  },
  ja: {
    classic: 'クラシック',
    sky: 'スカイ',
    winter: 'ウィンター',
    forest: 'フォレスト',
    meadow: 'メドウ',
    jeju: '済州',
    seoul: 'ソウル',
    busan: '釜山',
    blossom: 'さくら',
    contrast: 'ハイコントラスト',
  },
  es: {
    classic: 'Clásico',
    sky: 'Cielo',
    winter: 'Invierno',
    forest: 'Bosque',
    meadow: 'Pradera',
    jeju: 'Jeju',
    seoul: 'Seúl',
    busan: 'Busan',
    blossom: 'Cerezo',
    contrast: 'Alto contraste',
  },
  zh: {
    classic: '经典',
    sky: '天空',
    winter: '冬日',
    forest: '森林',
    meadow: '草原',
    jeju: '济州',
    seoul: '首尔',
    busan: '釜山',
    blossom: '樱花',
    contrast: '高对比',
  },
  fr: {
    classic: 'Classique',
    sky: 'Ciel',
    winter: 'Hiver',
    forest: 'Forêt',
    meadow: 'Prairie',
    jeju: 'Jeju',
    seoul: 'Séoul',
    busan: 'Busan',
    blossom: 'Cerisier',
    contrast: 'Contraste élevé',
  },
  de: {
    classic: 'Klassisch',
    sky: 'Himmel',
    winter: 'Winter',
    forest: 'Wald',
    meadow: 'Wiese',
    jeju: 'Jeju',
    seoul: 'Seoul',
    busan: 'Busan',
    blossom: 'Kirschblüte',
    contrast: 'Hoher Kontrast',
  },
  ru: {
    classic: 'Классика',
    sky: 'Небо',
    winter: 'Зима',
    forest: 'Лес',
    meadow: 'Луг',
    jeju: 'Чеджу',
    seoul: 'Сеул',
    busan: 'Пусан',
    blossom: 'Сакура',
    contrast: 'Высокий контраст',
  },
  it: {
    classic: 'Classico',
    sky: 'Cielo',
    winter: 'Inverno',
    forest: 'Foresta',
    meadow: 'Prato',
    jeju: 'Jeju',
    seoul: 'Seul',
    busan: 'Busan',
    blossom: 'Ciliegio',
    contrast: 'Contrasto elevato',
  },
};

/** Light-variant poster colors — keep in sync with app/tour-room-theme.css.
 *  `hill` is the T-D5 scenery hint: a soft horizon arc in the swatch for
 *  skins that carry a SkinScenery scene (contrast deliberately has none). */
const SWATCH: Record<TourSkin, { canvas: string; bubbleIn: string; bubbleMe: string; hill?: string }> = {
  classic: { canvas: '#eef1ee', bubbleIn: '#fcfcfb', bubbleMe: '#2e5e4e', hill: '#dbe4d8' },
  sky: { canvas: '#b9cddd', bubbleIn: '#fdfefe', bubbleMe: '#2e5e4e', hill: '#dbe7ef' },
  winter: { canvas: '#dde8f2', bubbleIn: '#ffffff', bubbleMe: '#46708f', hill: '#c9d9e9' },
  forest: { canvas: '#e4e8cd', bubbleIn: '#fbfaf2', bubbleMe: '#52702c', hill: '#cfd8ab' },
  meadow: { canvas: '#d6e6e2', bubbleIn: '#fdfefd', bubbleMe: '#37705f', hill: '#c0d9cc' },
  jeju: { canvas: '#e9f5ea', bubbleIn: '#fbfdf9', bubbleMe: '#a34d14', hill: '#d3e5d0' },
  seoul: { canvas: '#e7e5f0', bubbleIn: '#fdfdfe', bubbleMe: '#55519b', hill: '#d3d0e6' },
  busan: { canvas: '#cfe7f0', bubbleIn: '#fdfeff', bubbleMe: '#20596f', hill: '#b7d7e6' },
  blossom: { canvas: '#f8e6ec', bubbleIn: '#fefcfd', bubbleMe: '#99465f', hill: '#f0cedb' },
  contrast: { canvas: '#ffffff', bubbleIn: '#efefef', bubbleMe: '#111111' },
};

export default function SkinPicker({ locale }: { locale: RoomLocale }) {
  const { settings, update } = useTourRoomSettings();
  const names = SKIN_NAME[locale] ?? SKIN_NAME.en;

  return (
    <div className="grid grid-cols-3 gap-2" data-testid="skin-picker" role="radiogroup">
      {TOUR_SKINS.map((skin) => {
        const active = settings.skin === skin;
        const sw = SWATCH[skin];
        return (
          <button
            key={skin}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={names[skin]}
            onClick={() => update({ skin })}
            data-testid={`skin-${skin}`}
            className={`tr-press rounded-2xl border-2 p-1 text-center ${
              active ? 'border-[var(--tr-accent)]' : 'border-transparent'
            }`}
          >
            <span
              className="relative block h-14 w-full overflow-hidden rounded-xl border border-[var(--tr-hairline)]"
              style={{ background: sw.canvas }}
              aria-hidden
            >
              {/* T-D5 — scenery hint: one soft horizon arc where a scene lives. */}
              {sw.hill && (
                <span
                  className="absolute -bottom-3 -left-2 block h-6 w-14 rounded-[100%]"
                  style={{ background: sw.hill }}
                />
              )}
              <span
                className="absolute left-1.5 top-2 block h-3 w-8 rounded-full rounded-bl-[3px]"
                style={{ background: sw.bubbleIn }}
              />
              <span
                className="absolute bottom-2 right-1.5 block h-3 w-10 rounded-full rounded-br-[3px]"
                style={{ background: sw.bubbleMe }}
              />
              {active && (
                <span
                  className="absolute bottom-1 left-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--tr-accent)] text-[var(--tr-bubble-me-ink)]"
                  data-testid={`skin-check-${skin}`}
                >
                  <IconDone size={TR_ICON.meta - 4} strokeWidth={3} aria-hidden />
                </span>
              )}
            </span>
            <span
              className={`tr-meta text-cjk-safe mt-1 block max-w-full font-medium ${
                active ? 'text-[var(--tr-ink)]' : 'text-[var(--tr-ink-2)]'
              }`}
            >
              {names[skin]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
