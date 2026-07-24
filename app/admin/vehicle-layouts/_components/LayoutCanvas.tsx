'use client';

/**
 * 배치도 편집 캔버스 — AtoC 통합 플랜 §5.3b.
 *
 * 공용 <SeatMap>을 그대로 쓰되(같은 SVG, 같은 상태 색 — admin 미리보기와
 * 게스트 화면이 절대 갈라지지 않게), 그 위에 "빈 칸" 오버레이를 정확히
 * 겹쳐 그린다. SeatMap은 존재하는 좌석만 그리므로 빈 칸을 탭할 방법이
 * 없기 때문이다. 오버레이는 SeatMap이 내보내는 지오메트리
 * (seatCellXY / seatMapDimensions — additive export)를 써서 좌표를 맞춘다.
 *
 * 두 SVG는 같은 원점·같은 셀 크기를 쓰고 스케일을 걸지 않는다(좁은 화면에서는
 * 가로 스크롤). 배치도 편집은 정밀 작업이라 축소보다 스크롤이 낫다.
 */

import { useMemo } from 'react';
import SeatMap, { seatCellXY, seatMapDimensions } from '@/components/ops/SeatMap';
import { cellAt, layoutRows } from '@/lib/ops/seating/layoutEditor';
import type { VehicleLayoutJson } from '@/lib/ops/seating/layouts';
import type { SeatState } from '@/lib/ops/seating/logic';

/** 편집 도구. 'select'는 좌석 선택→이동, 나머지는 클릭 즉시 배치/삭제. */
export type EditorTool = 'select' | 'seat' | 'driver' | 'door' | 'facility' | 'stairs' | 'erase';

const CELL = 36;

export default function LayoutCanvas({
  layout,
  selectedSeat,
  highlightSeats,
  assignedSeats,
  checkedInSeats,
  tool,
  onSeatTap,
  onCellTap,
}: {
  layout: VehicleLayoutJson;
  selectedSeat: number | null;
  highlightSeats: number[];
  /** 이미 손님이 배정된 좌석 — 편집으로 지우면 그 손님 좌석이 사라진다. */
  assignedSeats: number[];
  checkedInSeats: number[];
  tool: EditorTool;
  onSeatTap: (seatNumber: number) => void;
  onCellTap: (r: number, c: number) => void;
}) {
  // 아래로 한 줄 여유를 둬서 좌석을 새 행에 추가할 수 있게 한다.
  const rows = layoutRows(layout) + 1;
  const cols = Math.max(1, layout.cols);
  const { width, height } = seatMapDimensions(cols, rows);

  const seatStates = useMemo(() => {
    const states: Record<number, SeatState> = {};
    for (const n of assignedSeats) states[n] = 'taken';
    for (const n of checkedInSeats) states[n] = 'checked_in';
    if (selectedSeat != null) states[selectedSeat] = 'mine';
    return states;
  }, [assignedSeats, checkedInSeats, selectedSeat]);

  const cells = useMemo(() => {
    const out: Array<{ r: number; c: number; kind: 'empty' | 'fixture' }> = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const occupant = cellAt(layout, r, c);
        if (occupant.kind === 'seat') continue; // 좌석 탭은 SeatMap이 받는다
        out.push({ r, c, kind: occupant.kind === 'fixture' ? 'fixture' : 'empty' });
      }
    }
    return out;
  }, [layout, rows, cols]);

  const hint =
    tool === 'select'
      ? selectedSeat != null
        ? `${selectedSeat}번 좌석 선택됨 — 빈 칸을 누르면 이동해요.`
        : '좌석을 눌러 선택하세요.'
      : tool === 'seat'
        ? '빈 칸을 누르면 좌석이 추가돼요.'
        : tool === 'erase'
          ? '좌석이나 설비를 누르면 지워져요.'
          : '빈 칸을 누르면 설비가 놓여요.';

  return (
    <div>
      <p className="mb-2 text-xs text-slate-500">{hint}</p>
      <div className="overflow-x-auto rounded-lg border border-admin-border bg-white p-3">
        <div className="relative" style={{ width, height }}>
          <SeatMap
            layout={layout}
            seatStates={seatStates}
            highlightSeats={highlightSeats}
            onSeatTap={onSeatTap}
            className="absolute left-0 top-0"
            ariaLabel="배치도 편집 캔버스"
          />
          <svg
            className="absolute left-0 top-0"
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            style={{ pointerEvents: 'none' }}
            aria-hidden="true"
          >
            {cells.map(({ r, c, kind }) => {
              const [x, y] = seatCellXY(r, c);
              return (
                <rect
                  key={`${r}:${c}`}
                  x={x}
                  y={y}
                  width={CELL}
                  height={CELL}
                  rx={7}
                  fill="transparent"
                  stroke={kind === 'empty' ? '#cbd5e1' : 'transparent'}
                  strokeDasharray={kind === 'empty' ? '2 4' : undefined}
                  strokeWidth={1}
                  style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                  onClick={() => onCellTap(r, c)}
                />
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}
