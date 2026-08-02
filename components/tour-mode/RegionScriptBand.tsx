'use client';

import { useState } from 'react';
import Sheet from '@/components/tour-mode/Sheet';
import type { RoomLocale } from '@/lib/tour-room/snapshot';
import {
  REGION_SCRIPT_UI,
  formatKm,
  googleMapsUrl,
  nearestStopKm,
  placeTagLabel,
  type RegionScriptCard,
  type RegionScriptPlace,
  type StopPoint,
} from '@/lib/tour-room/regionScripts';

/**
 * "제주 알아보기" — 오늘 일정 탭 맨 위의 가로 카드 띠.
 *
 * 왜 가로 스크롤인가: 세로로 쌓으면 16개가 일정을 화면 밖으로 밀어낸다. 이
 * 섹션은 일정의 보조지 주인공이 아니다. 한 화면에 1.4장쯤 보이게 해서 "옆에
 * 더 있다"만 알리고 끝낸다.
 *
 * 🔴 CJK 규칙: 카드 제목은 폭이 제한된 컨테이너에 들어가는 라벨이므로
 * `.text-cjk-safe`, 본문·티저는 어절 단위로 접혀야 하므로 `.text-cjk-body`.
 * 아무것도 안 주면 `한눈에` `보는` 이 아니라 `한` `눈` `에` 로 쪼개진다.
 */
export default function RegionScriptBand({
  cards,
  locale,
  stops,
}: {
  cards: RegionScriptCard[];
  locale: RoomLocale;
  /** 오늘 일정 스톱 좌표. 없으면 거리 줄이 통째로 빠진다(0으로 접지 않는다). */
  stops: StopPoint[];
}) {
  const [open, setOpen] = useState<RegionScriptCard | null>(null);
  const t = REGION_SCRIPT_UI[locale];

  if (cards.length === 0) return null;

  return (
    <section className="shrink-0 pt-3" aria-label={t.sectionTitle}>
      <div className="flex items-baseline gap-2 px-4">
        <h2 className="tr-title text-cjk-safe text-[var(--tr-ink)]">{t.sectionTitle}</h2>
        <span className="tr-meta text-cjk-safe text-[var(--tr-ink-3)]">{t.sectionHint}</span>
      </div>

      {/* 가장자리까지 흐르게 — 카드가 화면 끝에서 잘리면 "더 있다"가 읽힌다.
          스크롤바는 숨기고(tr-scroll-x) 스냅으로 손맛만 남긴다. */}
      <ul className="mt-2 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {cards.map((card) => (
          <li key={card.topicKey} className="snap-start">
            {/* data-topic: 하니스가 카드를 **순서나 번역된 제목이 아니라 키로**
                집게 한다. 번호로 집으면 주제 하나가 끼어드는 순간 다른 카드를
                찍고도 초록이고, 제목으로 집으면 로케일이 바뀌는 순간 깨진다. */}
            <button
              type="button"
              data-topic={card.topicKey}
              onClick={() => setOpen(card)}
              className="tr-card flex h-full w-[72vw] max-w-[280px] flex-col gap-1.5 p-3 text-left active:scale-[0.985]"
            >
              <div className="flex items-center gap-1.5">
                {/* 이모지도 tr-* 스케일을 쓴다(U4-D7). Tailwind 임의 픽셀값은
                    글자크기 승강(--tr-font-scale)을 통째로 무시해서, 크게 보기를
                    켠 손님에게만 이 한 글자가 안 커진다. AppManual의 섹션
                    이모지와 같은 급이 tr-display다.
                    ⚠ 위반 예시를 여기 그대로 적으면 안 된다 — typeDiscipline
                    스캐너는 주석을 걷어내지 않아서 산문을 코드로 읽는다. */}
                <span aria-hidden className="tr-display leading-none">
                  {card.icon ?? '📖'}
                </span>
                {card.sensitive && (
                  <span className="tr-meta text-cjk-safe rounded-full bg-[var(--tr-bubble-system)] px-1.5 py-0.5 text-[var(--tr-ink-3)]">
                    {t.sensitive}
                  </span>
                )}
              </div>
              <h3 className="tr-title text-cjk-body line-clamp-2 text-[var(--tr-ink)]">
                {card.title}
              </h3>
              <p className="tr-card-text text-cjk-body line-clamp-3 text-[var(--tr-ink-2)]">
                {card.teaser}
              </p>
              <span className="tr-meta text-cjk-safe mt-auto pt-1 text-[var(--tr-accent-deep)]">
                {t.readMore} →
              </span>
            </button>
          </li>
        ))}
      </ul>

      <Sheet open={open !== null} onClose={() => setOpen(null)} title={open?.title ?? ''}>
        {open && <ScriptBody card={open} locale={locale} stops={stops} />}
      </Sheet>
    </section>
  );
}

function ScriptBody({
  card,
  locale,
  stops,
}: {
  card: RegionScriptCard;
  locale: RoomLocale;
  stops: StopPoint[];
}) {
  const t = REGION_SCRIPT_UI[locale];
  // 빈 줄 두 개 = 문단. 원고가 마크다운이 아니라 평문이라 렌더러도 단순하다.
  const paragraphs = card.body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  const byTag = new Map<string, RegionScriptPlace[]>();
  for (const p of card.places) {
    const list = byTag.get(p.tag) ?? [];
    list.push(p);
    byTag.set(p.tag, list);
  }

  return (
    <div className="flex flex-col gap-4 pb-2">
      {/* 사진은 **시트에만** 둔다. 16주제 중 실사진을 붙일 수 있는 건 지금 다섯
          안팎이라, 띠에 넣으면 사진 있는 카드와 없는 카드가 섞여 줄이 어긋난다.
          전 주제가 채워지면 이 블록을 카드로 올리면 된다(한 곳만 옮기면 된다).
          alt는 비운다 — 시트 헤더가 이미 같은 제목을 읽는다. */}
      {card.imageUrl && (
        <figure className="-mt-1 flex flex-col gap-1">
          <img
            src={card.imageUrl}
            alt=""
            loading="lazy"
            className="h-44 w-full rounded-[var(--tr-radius-card)] object-cover"
          />
          {card.imageCredit && (
            <figcaption className="tr-meta text-cjk-body text-[var(--tr-ink-3)]">
              {card.imageCredit}
            </figcaption>
          )}
        </figure>
      )}

      {paragraphs.map((p, i) => (
        <p key={i} className="tr-card-text text-cjk-body leading-relaxed text-[var(--tr-ink)]">
          {p}
        </p>
      ))}

      {card.funFact && (
        <p className="tr-card-text text-cjk-body rounded-[var(--tr-radius-card)] bg-[var(--tr-accent-soft)] p-3 leading-relaxed text-[var(--tr-ink)]">
          💡 {card.funFact}
        </p>
      )}

      {byTag.size > 0 && (
        <div className="flex flex-col gap-3">
          <h4 className="tr-title text-cjk-safe text-[var(--tr-ink)]">{t.places}</h4>
          {/* 🔴 거리는 참고다. 앱은 갈 수 있다/없다를 말하지 않는다 — 차량·교통·
              잔여 시간을 아는 사람은 기사고, 앱이 단정하면 지킬 수 없는 약속이나
              불필요한 거절이 된다. 숫자를 주고 이 한 줄로 판단을 넘긴다. */}
          <p className="tr-meta text-cjk-body text-[var(--tr-ink-3)]">{t.askDriver}</p>

          {[...byTag.entries()].map(([tag, places]) => (
            <div key={tag} className="flex flex-col gap-1.5">
              <span className="tr-meta text-cjk-safe text-[var(--tr-ink-3)]">
                {placeTagLabel(tag, locale)}
              </span>
              {places.map((p) => {
                const km = nearestStopKm(p, stops);
                const map = googleMapsUrl(p);
                return (
                  <div
                    key={`${p.ko}-${p.lat ?? 0}`}
                    className="tr-card flex items-start gap-3 p-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="tr-card-text text-cjk-body font-semibold text-[var(--tr-ink)]">
                        {p.ko}
                        {p.en && p.en !== p.ko && (
                          <span className="text-cjk-body font-normal text-[var(--tr-ink-3)]">
                            {' '}
                            {p.en}
                          </span>
                        )}
                      </p>
                      {/* 주소·전화는 자유일정 때 쓰인다 — 택시 기사에게 보여주거나
                          지도앱에 그대로 넣을 수 있게 한국어 원문 그대로 둔다. */}
                      {p.addr && (
                        <p className="tr-meta text-cjk-body text-[var(--tr-ink-2)]">{p.addr}</p>
                      )}
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2">
                        {p.phone && (
                          <a
                            href={`tel:${p.phone.replace(/[^0-9+]/g, '')}`}
                            className="tr-meta text-cjk-safe tabular-nums text-[var(--tr-accent-deep)]"
                          >
                            {p.phone}
                          </a>
                        )}
                        {km !== null && (
                          <span className="tr-meta text-cjk-safe text-[var(--tr-ink-3)]">
                            {t.fromRoute.replace('{d}', formatKm(km))}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* 🔴 `.tr-chip`을 쓰면 안 된다. 그건 홈 타일 **아이콘**용
                        재질이라 배경을 `--base/--accent/--danger`가 주고, 클래스
                        하나만 붙이면 배경 없이 `color: var(--tr-chip-ink)`(#fcfcfb)만
                        남는다 — 흰 카드 위의 흰 글씨다. 탭 가능한 알약은
                        `.tr-chip-tap` 계열이고, 조용한 쪽 채움은 스킨에서 파생된
                        `--tr-chip-quiet-fill`이다(Composer·NowCard와 같은 문법). */}
                    {map && (
                      <a
                        href={map}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="tr-label tr-chip-tap tr-chip-tap--quiet text-cjk-safe shrink-0 self-center rounded-full bg-[var(--tr-chip-quiet-fill)] px-3 py-1.5 font-semibold text-[var(--tr-ink-2)]"
                      >
                        {t.openMap}
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {card.sources.length > 0 && (
        <details className="pt-1">
          <summary className="tr-meta text-cjk-safe cursor-pointer text-[var(--tr-ink-3)]">
            {t.sources}
          </summary>
          <ul className="mt-1.5 flex flex-col gap-1">
            {card.sources.map((s) => (
              <li key={s.url}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tr-meta text-cjk-body break-all text-[var(--tr-accent-deep)]"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
