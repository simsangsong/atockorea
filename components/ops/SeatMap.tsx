'use client';

/**
 * 공용 좌석배치도 SVG 렌더러 — AtoC 통합 플랜 §5.3b.
 *
 * ops_vehicle_layouts.layout_json(= lib/ops/seating/layouts.ts 정의)을 받아
 * SVG로 동적 렌더한다. 게스트 좌석 선택 화면 · 가이드 체크인 좌석판 ·
 * admin 미리보기가 전부 이 컴포넌트를 상태(seatStates)만 달리해 사용한다.
 *
 * 지오메트리(CELL/GAP/통로 오프셋)와 상태 클래스 체계는 검증 데모
 * (atoc-seatmap-demo.html)에서 그대로 이식. 색만 투어룸 디자인 토큰
 * (app/tour-room-theme.css의 --tr-*)으로 치환 — `.tr-root` (+ `.dark`)
 * 하위에서 렌더하면 라이트/다크가 자동 적용된다. 세부 색을 바꾸고 싶은
 * 소비 화면은 --tr-seat-* 오버라이드 변수만 재정의하면 된다.
 *
 * 탭 정책: readOnly가 아니면 모든 좌석 탭이 onSeatTap(n)으로 전달된다
 * (taken/checked_in 좌석 포함 — 가이드 수동 체크인 C-13③ 경로가 필요로 함).
 * "게스트는 taken 좌석 선택 불가" 같은 도메인 규칙은 소비 화면/서버가
 * 판정한다 (서버 단 UNIQUE가 최종 방어선 — C-10).
 */

import { useMemo } from 'react';
import type { KeyboardEvent } from 'react';
import type { FixtureType, VehicleLayoutJson } from '@/lib/ops/seating/layouts';
import type { SeatState } from '@/lib/ops/seating/logic';

/* 데모와 동일한 지오메트리 상수. */
const CELL = 36;
const GAP = 7;
const PADX = 14;
const PADY = 12;
const AISLE = 14; // c>=2 좌석/설비에 더해지는 통로 오프셋

function xy(r: number, c: number): [number, number] {
  return [PADX + c * (CELL + GAP) + (c >= 2 ? AISLE : 0), PADY + r * (CELL + GAP)];
}

/**
 * 지오메트리 공개 (§5.3b admin 배치도 에디터 — additive).
 *
 * 에디터는 이 컴포넌트 위에 "빈 칸" 오버레이 SVG를 정확히 겹쳐 그려야 한다
 * (SeatMap은 존재하는 좌석만 그리므로 빈 칸을 탭할 방법이 없다). 렌더 로직을
 * 건드리는 대신 좌표 계산만 내보낸다 — 기존 소비 화면 동작은 완전 무변경.
 */
export const SEAT_GEOMETRY = { CELL, GAP, PADX, PADY, AISLE } as const;

/** 격자 좌표 → SVG 좌상단 (x, y). SeatMap 내부 배치와 동일. */
export function seatCellXY(r: number, c: number): [number, number] {
  return xy(r, c);
}

/** 오버레이 SVG가 써야 할 viewBox 크기 (cols × rows 기준). */
export function seatMapDimensions(cols: number, rows: number): { width: number; height: number } {
  return {
    width: PADX * 2 + cols * (CELL + GAP) + AISLE,
    height: PADY * 2 + rows * (CELL + GAP),
  };
}

/** 기본 설비 라벨 (데모와 동일 — 소비 화면에서 로케일별 오버라이드 가능). */
export const DEFAULT_FIXTURE_LABELS: Record<FixtureType, string> = {
  driver: '운전석',
  door: '출입문',
  facility: '설비',
  stairs: '계단',
};

/** §5.3b 상태 색 규약 → --tr-* 토큰 (오버라이드용 --tr-seat-* 변수 포함). */
const SEAT_STYLE: Record<
  SeatState,
  { fill: string; stroke: string; strokeWidth: number; ink: string; opacity?: number }
> = {
  available: {
    fill: 'var(--tr-seat-avail, var(--tr-surface, #fcfcfb))',
    stroke: 'var(--tr-seat-avail-b, var(--tr-ink-3, #9ca3af))',
    strokeWidth: 1.5,
    ink: 'var(--tr-ink, #1a1d21)',
  },
  mine: {
    fill: 'var(--tr-seat-mine, var(--tr-bubble-me, #252a2c))',
    stroke: 'var(--tr-seat-mine-b, var(--tr-accent-deep, #111315))',
    strokeWidth: 1.5,
    ink: 'var(--tr-seat-mine-ink, var(--tr-bubble-me-ink, #fcfcfb))',
  },
  taken: {
    fill: 'var(--tr-seat-taken, var(--tr-surface-2, #ecefee))',
    stroke: 'var(--tr-seat-taken-b, var(--tr-ink-3, #9ca3af))',
    strokeWidth: 1.5,
    ink: 'var(--tr-ink-3, #6e767f)',
  },
  checked_in: {
    fill: 'var(--tr-seat-green, var(--tr-safe-soft, #dce9e2))',
    stroke: 'var(--tr-seat-green-b, var(--tr-safe, #3f6b58))',
    strokeWidth: 2,
    ink: 'var(--tr-safe, #3f6b58)',
  },
  absent: {
    fill: 'var(--tr-seat-noshow, var(--tr-surface-2, #ecefee))',
    stroke: 'var(--tr-seat-noshow-b, var(--tr-ink-2, #565d66))',
    strokeWidth: 1.5,
    ink: 'var(--tr-ink-2, #565d66)',
  },
  locked: {
    fill: 'var(--tr-seat-locked, var(--tr-surface-2, #ecefee))',
    stroke: 'var(--tr-seat-locked-b, var(--tr-hairline, rgba(37,42,44,0.16)))',
    strokeWidth: 1.5,
    ink: 'var(--tr-ink-3, #6e767f)',
    opacity: 0.72,
  },
};

const HL_STROKE = 'var(--tr-seat-hl, #2563eb)';
const HL_STROKE_WIDTH = 3;
/** 그룹 액센트 테두리 — 상태 테두리보다 굵고 하이라이트보다 얇다 (아래 우선순위 주석). */
const ACCENT_STROKE_WIDTH = 2.5;

/**
 * 좌석 위에 겹치는 "소속" 표시 (§5.4b 픽업그룹 색 오버레이 등).
 *
 * 🔴 우선순위 규약 — 상태색이 그룹색을 이긴다:
 *   · 채움(fill)·숫자 잉크는 언제나 좌석 상태(체크인/노쇼/내 좌석/잠금)의 것이다.
 *     운영상 "이 사람이 탔는가"가 "이 사람이 어디서 타는가"보다 항상 중요하고,
 *     면적이 큰 채움이 그 질문의 답이어야 한다.
 *   · 그룹색은 테두리에만 얹는다 — 상태를 가리지 않으면서 스캔은 가능한 위치.
 *   · 하이라이트(명단 행 hover)는 그 테두리마저 덮는다: 가이드가 방금 "이 팀"이라고
 *     지목한 일시적 의도가, 항상 켜져 있는 그룹 배경보다 우선한다.
 *   → 최종: 하이라이트 > 그룹 액센트 > 상태 테두리. 채움은 언제나 상태.
 *
 * 색만으로 뜻이 전달되면 안 되므로 label(좌석 안 작은 배지) + description(aria)이
 * 함께 온다. 소비 화면이 도메인 의미를 정하고, SeatMap은 그리기만 한다.
 */
export interface SeatAccentDecoration {
  /** 테두리 색 (literal 또는 CSS 변수). */
  color: string;
  /** 좌석 안에 찍히는 짧은 배지 (예: 픽업 그룹 번호). */
  label?: string;
  /** aria-label 끝에 덧붙는 설명 (예: "픽업 2 롯데호텔"). */
  description?: string;
}

export interface SeatMapProps {
  /** ops_vehicle_layouts.layout_json (또는 layouts.ts의 시드 정의). */
  layout: VehicleLayoutJson;
  /** 좌석번호 → 상태. 생략된 좌석은 available. (lib/ops/seating/logic.ts buildSeatStateMap) */
  seatStates?: Record<number, SeatState>;
  /** party 좌석 하이라이트 (명단 행 hover/탭 — §5.4b 양방향 내비게이션). */
  highlightSeats?: number[];
  /**
   * 좌석번호 → 소속 액센트 (선택). 지정된 좌석만 테두리색+배지를 얹는다.
   * 미지정이면 이 컴포넌트의 기존 동작과 100% 동일 (순수 additive).
   */
  seatAccents?: Record<number, SeatAccentDecoration>;
  /** 좌석 탭 콜백. readOnly거나 미지정이면 좌석이 인터랙티브하지 않다. */
  onSeatTap?: (seatNumber: number) => void;
  /** true면 순수 표시 전용 (admin 미리보기 등). */
  readOnly?: boolean;
  /** 좌석번호 → 게스트 라벨 (aria/title 보강 — C-9 이름 라벨). */
  seatLabels?: Record<number, string>;
  /** 설비 라벨 오버라이드 (로케일 대응). */
  fixtureLabels?: Partial<Record<FixtureType, string>>;
  className?: string;
  /** 접근성 이름 (기본: "seat map"). */
  ariaLabel?: string;
}

export default function SeatMap({
  layout,
  seatStates = {},
  highlightSeats,
  seatAccents,
  onSeatTap,
  readOnly = false,
  seatLabels = {},
  fixtureLabels,
  className,
  ariaLabel = 'seat map',
}: SeatMapProps) {
  const highlighted = useMemo(() => new Set(highlightSeats ?? []), [highlightSeats]);
  const labels = { ...DEFAULT_FIXTURE_LABELS, ...fixtureLabels };

  const maxR = useMemo(
    () =>
      Math.max(
        ...layout.seats.map((s) => s.r),
        ...layout.fixtures.map((f) => f.r),
        0,
      ),
    [layout],
  );
  const width = PADX * 2 + layout.cols * (CELL + GAP) + AISLE;
  const height = PADY * 2 + (maxR + 1) * (CELL + GAP);

  const interactive = !readOnly && typeof onSeatTap === 'function';

  const handleKey = (e: KeyboardEvent, n: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSeatTap?.(n);
    }
  };

  return (
    <svg
      className={className}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
      role="group"
      aria-label={ariaLabel}
      data-testid="seat-map"
    >
      {/* 차체 외곽선 */}
      <rect
        x={3}
        y={3}
        width={width - 6}
        height={height - 6}
        rx={18}
        fill="none"
        stroke="var(--tr-hairline, rgba(37,42,44,0.12))"
        strokeWidth={2}
      />

      {/* 설비 (운전석/문/설비/계단 — 점선, 비선택) */}
      {layout.fixtures.map((f, i) => {
        const [x, y] = xy(f.r, f.c);
        const w = (f.w ?? 1) * (CELL + GAP) - GAP;
        return (
          <g key={`fx-${i}`} className={`sm-fixture sm-fixture--${f.type}`} aria-hidden="true">
            <rect
              x={x}
              y={y}
              width={w}
              height={CELL}
              rx={6}
              fill="none"
              stroke="var(--tr-ink-3, #6e767f)"
              strokeDasharray="3 3"
            />
            <text
              x={x + w / 2}
              y={y + CELL / 2}
              fontSize={9}
              fill="var(--tr-ink-3, #6e767f)"
              textAnchor="middle"
              dominantBaseline="central"
              style={{ pointerEvents: 'none' }}
            >
              {labels[f.type]}
            </text>
          </g>
        );
      })}

      {/* 좌석 */}
      {layout.seats.map((s) => {
        const [x, y] = xy(s.r, s.c);
        const state: SeatState = seatStates[s.n] ?? 'available';
        const st = SEAT_STYLE[state];
        const hl = highlighted.has(s.n);
        const accent = seatAccents?.[s.n];
        const label = seatLabels[s.n];
        const aria = `${label ? `${label} — ` : ''}seat ${s.n} (${state})${
          accent?.description ? ` — ${accent.description}` : ''
        }`;
        // 하이라이트 > 그룹 액센트 > 상태 (채움은 언제나 상태 — 위 규약 주석).
        const stroke = hl ? HL_STROKE : accent ? accent.color : st.stroke;
        const strokeWidth = hl ? HL_STROKE_WIDTH : accent ? ACCENT_STROKE_WIDTH : st.strokeWidth;
        return (
          <g
            key={s.n}
            data-seat={s.n}
            data-state={state}
            data-accent={accent?.label ?? undefined}
            className={`sm-seat sm-seat--${state}${hl ? ' sm-seat--hl' : ''}${accent ? ' sm-seat--accent' : ''}`}
            role={interactive ? 'button' : 'img'}
            aria-label={aria}
            aria-disabled={interactive ? undefined : true}
            tabIndex={interactive ? 0 : undefined}
            onClick={interactive ? () => onSeatTap?.(s.n) : undefined}
            onKeyDown={interactive ? (e) => handleKey(e, s.n) : undefined}
            style={{ cursor: interactive ? 'pointer' : 'default', opacity: st.opacity }}
          >
            <rect
              x={x}
              y={y}
              width={CELL}
              height={CELL}
              rx={7}
              fill={st.fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
            />
            <text
              x={x + CELL / 2}
              y={y + CELL / 2}
              fontSize={10.5}
              fill={st.ink}
              fontWeight={state === 'mine' || state === 'checked_in' ? 700 : 400}
              textDecoration={state === 'absent' ? 'line-through' : undefined}
              textAnchor="middle"
              dominantBaseline="central"
              style={{ pointerEvents: 'none' }}
            >
              {s.n}
            </text>
            {/* 색맹 대비 2차 신호 — 그룹 번호 배지 (색과 항상 함께 온다). */}
            {accent?.label && (
              <text
                x={x + CELL - 4.5}
                y={y + 6.5}
                fontSize={8}
                fontWeight={700}
                fill={accent.color}
                textAnchor="end"
                dominantBaseline="hanging"
                style={{ pointerEvents: 'none' }}
              >
                {accent.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
