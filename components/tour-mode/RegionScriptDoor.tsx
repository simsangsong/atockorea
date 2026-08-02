'use client';

import { useEffect, useRef, useState } from 'react';
import Sheet from '@/components/tour-mode/Sheet';
import {
  IconBack,
  IconChevronRight,
  IconExplore,
  TR_ICON,
  TR_STROKE,
} from '@/components/tour-mode/icons';
import type { RoomLocale } from '@/lib/tour-room/snapshot';
import {
  REGION_SCRIPT_UI,
  formatKm,
  googleMapsUrl,
  nearestStopKm,
  parseEmphasis,
  placeTagLabel,
  type RegionScriptCard,
  type RegionScriptPlace,
  type StopPoint,
} from '@/lib/tour-room/regionScripts';

/**
 * 「제주 알아보기」 — 오늘 일정 탭 상단의 **문 하나**, 그리고 그 뒤의 카드 리스트.
 *
 * 전에는 가로 카드 띠였다. 사장님 판단(2026-08-02): *"카드들이 횡으로 배열돼서
 * 한눈에 안 들어와."* 맞다 — 16편을 옆으로 눕히면 한 화면에 1.4장이 보이고,
 * 나머지 14.6장은 존재를 모른다. 게다가 띠는 일정 위에 330px을 상시 점유했다.
 *
 * 이제 56px 버튼 하나가 서 있고, 열면 세로 리스트가 나온다. 문+시트 문법은
 * `AppManual` `variant='button'`에서 그대로 가져왔다 — 앱에 이미 있는 재질이다.
 *
 * 🔴 액센트는 **아이콘 칩에만**. 슬래브 전체를 액센트로 덮은 판본이 있었고
 * 되돌렸다(AppManual 주석, 2026-07-28): *"가장 안 급한 것이 가장 큰 것이 됐다.
 * 강조는 예산이고, 오늘 어디 있는지 알려주는 카드가 1순위다."* 일정 탭의
 * 주인공은 오늘 일정이지 이 문이 아니다.
 *
 * 리스트 → 전문은 **같은 시트 안에서** 전환한다(시트 2단은 iOS 뒤로가기가 꼬인다).
 * 그래서 스크롤과 포커스를 직접 옮겨야 한다 — 아래 useEffect 참고.
 */
export default function RegionScriptDoor({
  cards,
  locale,
  stops,
}: {
  /**
   * `null` = 아직 안 불러옴, `[]` = 이 상품엔 해설이 없음(서울·포천).
   * 둘을 구분하는 이유는 레이아웃 시프트다 — null일 때 자리를 비워 두면
   * 카드가 도착하는 순간 일정 첫 장이 56px 아래로 튄다.
   */
  cards: RegionScriptCard[] | null;
  locale: RoomLocale;
  /** 오늘 일정 스톱 좌표. 없으면 거리 줄이 통째로 빠진다(0으로 접지 않는다). */
  stops: StopPoint[];
}) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<RegionScriptCard | null>(null);
  const topRef = useRef<HTMLDivElement | null>(null);
  const t = REGION_SCRIPT_UI[locale];

  /**
   * 표지로 세울 한 편. `null` = 아직 안 골랐다.
   *
   * 🔴 하이드레이션 때문에 **효과 안에서** 고른다. `useState(() => random())`
   * 로 첫 렌더에 뽑으면 서버·클라이언트가 다른 편을 그려 트리가 통째로 재생성된다
   * (2026-07-17에 로케일 감지로 같은 사고를 한 번 냈다). 고르기 전에는 아래
   * 스켈레톤을 그대로 두므로 **깜빡임도 없다** — 사진이 바뀌는 프레임이 없다.
   */
  const [featured, setFeatured] = useState<RegionScriptCard | null>(null);
  useEffect(() => {
    if (!cards || cards.length === 0) return;
    // 사진이 붙은 편을 우선한다. 표지의 8할은 사진이고, 16편 중 셋뿐이라
    // 무작위로 뽑으면 열에 여덟은 이모지 표지가 된다.
    const pool = cards.filter((c) => c.imageUrl);
    const from = pool.length > 0 ? pool : cards;
    setFeatured(from[Math.floor(Math.random() * from.length)] ?? from[0]);
  }, [cards]);

  /**
   * 🔴 시트 하나를 두 화면이 나눠 쓰므로 스크롤과 포커스가 저절로 따라오지 않는다.
   * `Sheet`는 열릴 때 한 번만 패널에 포커스를 준다. 전환 때 아무것도 안 하면
   * 리스트를 반쯤 내려서 고른 손님은 **전문의 중간부터** 보게 되고, 리더는 화면이
   * 바뀐 것을 알리지 않는다. 맨 위 센티넬로 스크롤을 되감고 포커스를 옮긴다.
   */
  useEffect(() => {
    if (!open) return;
    topRef.current?.scrollIntoView({ block: 'start' });
    topRef.current?.focus({ preventScroll: true });
  }, [open, detail?.topicKey]);

  const close = () => {
    setOpen(false);
    // 다음에 열 때 리스트부터 — 지난번 읽던 전문이 튀어나오면 문의 의미가 없다.
    setDetail(null);
  };

  // 아직 안 불러왔거나(=null) 표지를 아직 안 골랐다 — 자리만 잡아둔다.
  // 도착하면 그 자리에 문이 들어선다.
  if (cards === null || (cards.length > 0 && featured === null)) {
    return (
      <section className="shrink-0 px-3 pt-3" aria-hidden>
        <div className="tr-card min-h-[148px] w-full animate-pulse opacity-40" />
      </section>
    );
  }

  // 지역이 안 잡히는 상품(서울·포천)은 문 자체가 없다. 오류가 아니다.
  if (cards.length === 0 || !featured) return null;

  return (
    <section className="shrink-0 px-3 pt-3">
      {/*
       * 🔴 표지 카드다 — 설정 메뉴 행이 아니다.
       *
       * 이 자리엔 56px 짜리 행이 있었다: 초록 동그라미 + 「제주 알아보기」 +
       * 「16편 · 길에서 읽는 짧은 글」 + 회색 꺾쇠. 사장님 판정(2026-08-02):
       * *"지금은 설명서 느낌이라 클릭 안하고 싶어."* 맞다. 그 행이 보여준 건
       * **메타데이터**였다 — 분류가 있고 개수가 있다는 사실. 정작 열어보게
       * 만드는 문장은 전부 안에 갇혀 있었다.
       *
       * 그래서 문이 안의 것을 하나 꺼내 든다. 「2,371명이 남았고 그중 63%가
       * 일흔을 넘겼습니다」는 「제주 알아보기」가 절대 못 하는 일을 한다.
       * 아이콘·행 문법을 버리고 사진 표지로 바꾼 것도 같은 이유다 — 좌측
       * 아이콘 + 우측 텍스트는 세상 모든 설정 화면의 문법이라, 크기만 키우면
       * 큰 설정 행이 될 뿐이다.
       *
       * 잉크는 전부 아래 3분의 1, 스크림이 가장 짙은 곳에만 둔다. 그래야
       * ① 사진 윗부분이 안 가려지고 ② 사진이든 액센트 워시든 10스킨 × 명암
       * 어디서도 흰 글씨가 읽힌다. 스크림이 있으니 뒤가 무엇이든 상관없다.
       *
       * 높이 56 → 148px. 예전 가로 띠(330px 상주)의 절반 미만이고, 일정 탭의
       * 주인공은 여전히 오늘 일정이다.
       */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        // `text-cjk-body`는 전역 기본값이라 렌더에는 아무 영향이 없지만, CJK
        // 스캐너는 **컨트롤 자신의 className**만 보고 보호 여부를 판정한다
        // (`lib/audit/cjkBreak.ts` PROTECTED). 자식이 안전해도 버튼이 표시가
        // 없으면 suspect로 세어 ratchet 한도를 밀어 올린다.
        className="tr-press text-cjk-body relative block w-full overflow-hidden rounded-[var(--tr-radius-card)] text-left shadow-[var(--tr-rim),var(--tr-tile-shadow)]"
        data-testid="region-scripts-door"
      >
        {featured.imageUrl ? (
          <img
            src={featured.imageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          // 사진이 아직 없는 편이 표지가 되면 스킨 액센트 워시 + 큰 이모지.
          // 빈 회색 상자가 되지 않게 하는 것이 유일한 목적이다.
          <span
            aria-hidden
            className="tr-topic-tile absolute inset-0 flex items-start justify-center pt-5"
          >
            {/* 크기는 `.tr-emoji-tile`(40px × font-scale)로 — 임의 px 은 타입
                사다리를 우회한다(`typeDiscipline` 게이트가 잡는다). */}
            <span className="tr-emoji-tile leading-none">{featured.icon ?? '📖'}</span>
          </span>
        )}
        {/* 스크림 — 흰 잉크의 가독성이 사진 밝기에 좌우되지 않게 하는 장치다. */}
        <span
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-[rgba(8,12,16,0.88)] via-[rgba(8,12,16,0.42)] to-[rgba(8,12,16,0.06)]"
        />
        <span className="relative flex min-h-[148px] flex-col justify-end gap-2 p-4">
          {/* 🔴 알약은 **아이브로 줄에** 있어야 한다. 티저와 같은 줄에 뒀더니
              후크가 알약 너비만큼 잘렸다(일본어 실측: 「ひとつの火山がつくった島
              —— ここのほとんどは、…」에서 끊김). 문을 열게 만드는 건 그 문장이고,
              알약은 이미 카드 전체가 버튼이라 위치는 자유롭다. */}
          <span className="flex items-center gap-1.5">
            <IconExplore
              size={TR_ICON.meta}
              strokeWidth={TR_STROKE.small}
              aria-hidden
              className="shrink-0 text-white/75"
            />
            {/* 편수가 문을 여는 동기다 — "읽을 게 있다"가 아니라 "16편 있다". */}
            <span className="tr-meta text-cjk-safe min-w-0 flex-1 font-semibold text-white/75">
              {t.doorSubtitle.replace('{n}', String(cards.length))}
            </span>
            {/* 회색 꺾쇠는 "더 있음"이라고만 했다. 흰 알약은 눌린다고 말한다.
                스크림 위이므로 색은 스킨을 따르지 않는다 — 이 카드는 밝기가
                스스로 정해진 독립 표면(사진)이고, 그 위에서 가장 확실히
                읽히는 조합은 흰 바탕 + 검은 잉크다. */}
            <span className="tr-meta text-cjk-safe inline-flex shrink-0 items-center gap-0.5 rounded-full bg-white py-1.5 pl-3 pr-2 font-bold text-[#12161a]">
              {t.readMore}
              <IconChevronRight
                size={TR_ICON.meta}
                strokeWidth={TR_STROKE.small}
                aria-hidden
              />
            </span>
          </span>
          {/* 표제는 제목이 아니라 **티저**다. 「제주 알아보기」는 분류고,
              이 문장은 읽고 싶게 만드는 한 줄이다. 안에 있는 16편 중
              한 편의 맛보기이므로 위 아이브로가 "16편 중 하나"라고 말해 준다. */}
          <span className="tr-title text-cjk-body line-clamp-2 font-bold leading-snug text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.5)]">
            {featured.teaser}
          </span>
        </span>
      </button>

      <Sheet
        open={open}
        onClose={close}
        closeLabel={t.close}
        title={
          detail ? (
            <span className="flex min-w-0 items-center gap-1">
              <button
                type="button"
                onClick={() => setDetail(null)}
                aria-label={t.back}
                className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--tr-ink-3)] active:bg-[var(--tr-bubble-system)]"
                data-testid="region-scripts-back"
              >
                <IconBack size={TR_ICON.action} strokeWidth={TR_STROKE.default} />
              </button>
              <span className="text-cjk-safe min-w-0">{detail.title}</span>
            </span>
          ) : (
            <span className="text-cjk-safe">{t.sectionTitle}</span>
          )
        }
      >
        {/* 전환마다 여기로 스크롤·포커스가 되감긴다. */}
        <div ref={topRef} tabIndex={-1} className="outline-none" />
        {detail ? (
          <ScriptBody card={detail} locale={locale} stops={stops} />
        ) : (
          <ScriptList cards={cards} locale={locale} onPick={setDetail} />
        )}
      </Sheet>
    </section>
  );
}

/**
 * 세로 카드 리스트.
 *
 * 좌측 64px 슬롯은 **고정 크기**다. 16편 중 실사진이 붙은 것은 지금 셋뿐이라,
 * 슬롯이 내용에 따라 커졌다 작아졌다 하면 줄이 어긋나 리스트가 깨져 보인다.
 * 사진이든 이모지든 같은 상자에 들어간다 — 소재가 채워질수록 저절로 좋아진다.
 */
function ScriptList({
  cards,
  locale,
  onPick,
}: {
  cards: RegionScriptCard[];
  locale: RoomLocale;
  onPick: (card: RegionScriptCard) => void;
}) {
  const t = REGION_SCRIPT_UI[locale];
  return (
    <ul className="flex flex-col gap-2 pb-2">
      {cards.map((card) => (
        <li key={card.topicKey}>
          <button
            type="button"
            data-topic={card.topicKey}
            onClick={() => onPick(card)}
            className="tr-card tr-press text-cjk-body flex w-full items-center gap-3.5 p-3 text-left"
          >
            <span className="tr-topic-tile flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-[calc(var(--tr-radius-card)-2px)]">
              {card.imageUrl ? (
                <img
                  src={card.imageUrl}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span aria-hidden className="tr-emoji-tile">
                  {card.icon ?? '📖'}
                </span>
              )}
            </span>
            <span className="min-w-0 flex-1">
              {card.sensitive && (
                <span className="tr-meta text-cjk-safe mb-1 inline-block rounded-full bg-[var(--tr-bubble-system)] px-1.5 py-0.5 text-[var(--tr-ink-3)]">
                  {t.sensitive}
                </span>
              )}
              {/* 🔴 `block` 을 같이 주면 안 된다. `line-clamp-*` 는 `display:-webkit-box`
                  로 동작하는데 `block` 이 그걸 덮어써서 **클램프가 조용히 무효가 된다**
                  — 실렌더에서 2줄로 자를 티저가 3줄로 흘렀다(2026-08-02). */}
              <span className="tr-card-text text-cjk-body line-clamp-1 font-semibold text-[var(--tr-ink)]">
                {card.title}
              </span>
              {/* 🔴 티저는 `tr-meta`(11px) 였다 — 줄에서 **가장 작은 글씨**가 하필
                  가장 공들여 쓴 한 줄이었다는 뜻이다. 카드를 열게 만드는 건 제목이
                  아니라 이 문장이다("2,371명이 남았고 그중 63%가 일흔을 넘겼습니다").
                  본문과 같은 13px 로 올린다. 평문이다 — 강조 마크업은 body 에만 넣는다. */}
              <span className="tr-card-text text-cjk-body mt-1 line-clamp-2 leading-snug text-[var(--tr-ink-2)]">
                {card.teaser}
              </span>
            </span>
            <IconChevronRight
              size={TR_ICON.action}
              strokeWidth={TR_STROKE.default}
              aria-hidden
              className="shrink-0 text-[var(--tr-ink-3)]"
            />
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * 본문 문단. `**강조**`가 잉크 한 단계 + 굵기로 뜬다.
 *
 * 🔴 본문 기본색을 `--tr-ink-2`로 한 단계 낮춘 것이 강조의 절반이다. 강조만
 * 굵게 하면 축이 하나뿐이라 잘 안 읽히고, 강조에 액센트색을 쓰면 링크·칩과
 * 섞여 "누를 수 있는 것"처럼 보인다. 색은 늘리지 않고 위계만 만든다.
 */
function Paragraph({ text }: { text: string }) {
  return (
    <p className="tr-card-text text-cjk-body leading-relaxed text-[var(--tr-ink-2)]">
      {parseEmphasis(text).map((span, i) =>
        span.strong ? (
          <strong key={i} className="font-semibold text-[var(--tr-ink)]">
            {span.text}
          </strong>
        ) : (
          <span key={i}>{span.text}</span>
        ),
      )}
    </p>
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
      {card.imageUrl && (
        <figure className="flex flex-col gap-1">
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
        <Paragraph key={i} text={p} />
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
                    className="tr-card flex items-center gap-3 p-2.5"
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
                      {/* 🔴 전화와 거리를 한 줄 flex에 같이 두면 줄바꿈이 일어날 때
                          거리가 전화 뒤에서 시작해 어중간하게 들여쓰인 것처럼 보인다
                          (2026-08-02 실렌더). 둘은 성격도 다르다 — 하나는 누르는 것,
                          하나는 읽는 것. 세로로 쌓는다. */}
                      {p.phone && (
                        <a
                          href={`tel:${p.phone.replace(/[^0-9+]/g, '')}`}
                          // 🔴 인라인 style 이어야 한다. `app/globals.css` 의
                          // `button, a { min-height: 44px }` 는 레이어 밖 규칙이라
                          // Tailwind 유틸리티(@layer utilities)를 이긴다 — 클래스로
                          // 주면 조용히 무시된다(실측 44px). 아래 §지도 칩 주석 참고.
                          style={{ minHeight: 0 }}
                          // 11px 한 줄이라 상자가 14.3px 다 — 44px 을 채우려면
                          // 위아래로 각각 15px 이 필요하다(14.3 + 30 = 44.3).
                          // 알약(24.3px)과 값이 다른 이유는 상자 높이가 달라서지
                          // 규칙이 달라서가 아니다.
                          className="tr-meta text-cjk-safe relative mt-0.5 inline-flex items-center tabular-nums text-[var(--tr-accent-deep)] after:absolute after:-inset-y-[15px] after:-inset-x-2 after:content-['']"
                        >
                          {p.phone}
                        </a>
                      )}
                      {km !== null && (
                        <p className="tr-meta text-cjk-safe text-[var(--tr-ink-3)]">
                          {t.fromRoute.replace('{d}', formatKm(km))}
                        </p>
                      )}
                    </div>
                    {/* 🔴 `.tr-chip`을 쓰면 안 된다. 그건 홈 타일 **아이콘**용
                        재질이라 배경을 `--base/--accent/--danger`가 주고, 클래스
                        하나만 붙이면 배경 없이 흰 잉크만 남는다 — 흰 카드 위의
                        흰 글씨다. 탭 가능한 알약은 `.tr-chip-tap` 계열이다.

                        🔴 그리고 `min-height: 0` 을 **인라인으로** 줘야 한다.
                        `app/globals.css` 에 앱 전역 `button, a { min-height: 44px }`
                        가 있고, 그건 레이어 밖 규칙이라 Tailwind 유틸리티를 이긴다.
                        그래서 11px 라벨이 44px 상자에 앉아 있었다 — 사장님이
                        "글씨에 비해 버튼이 너무 크다"고 하신 것의 진짜 원인이다
                        (실측 44.0px, 2026-08-02).

                        전역 규칙 자체는 손대지 않는다. 그건 앱 전체의 접근성
                        바닥이다. 대신 **보이는 크기와 만지는 크기를 분리**한다:
                        알약은 24px, `after` 가 46px 히트 영역을 만든다. 그게
                        전역 규칙이 지키려던 것을 그대로 지키는 방법이다. */}
                    {map && (
                      <a
                        href={map}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ minHeight: 0 }}
                        className="tr-meta tr-chip-tap tr-chip-tap--quiet text-cjk-safe relative shrink-0 rounded-full bg-[var(--tr-chip-quiet-fill)] px-2.5 py-1 font-semibold text-[var(--tr-ink-2)] after:absolute after:-inset-[11px] after:content-['']"
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
