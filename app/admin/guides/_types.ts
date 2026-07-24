/** /admin/guides 화면이 쓰는 행 모양 — API가 돌려주는 것과 1:1.
 *  `*_enc`가 없는 것이 요점이다: 봉투는 응답에 실리지 않으므로 타입에도 없다. */

export interface GuideListRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  languages: string[] | null;
  guide_type: string | null;
  rrn_masked: string | null;
  bank_name: string | null;
  bank_holder: string | null;
  bank_account_masked: string | null;
  certified: boolean;
  active: boolean;
  note: string | null;
  created_at: string;
  updated_at: string;
  /** 목록 전용 집계 — 이번 달 휴무 일수. */
  unavailable_this_month?: number;
}

export interface RateRow {
  id: string;
  guide_id: string | null;
  tour_type: string;
  amount_krw: number;
  effective_from: string;
  note: string | null;
  created_at?: string;
}

/** ops_guide_assignments 행 + 목록 조인으로 붙는 가이드 이름. PII는 없다. */
export interface AssignmentListRow {
  id: string;
  guide_id: string;
  booking_id: string | null;
  room_id: string | null;
  tour_date: string;
  tour_type: string;
  role: string;
  amount_krw: number | null;
  status: string;
  note: string | null;
  guide_name?: string | null;
}

export interface ResolvedRateRow {
  tourType: string;
  amountKrw: number;
  scope: 'guide' | 'default';
  effectiveFrom: string;
  rowId: string | null;
  note: string | null;
}
