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
  /** W2 — 겹침 판정의 근거가 되는 시각 스냅샷. null = 미상. */
  start_time?: string | null;
  end_time?: string | null;
  assigned_by?: string | null;
  conflict_override?: boolean;
  conflict_override_reason?: string | null;
}

/** W2 — 배정 API가 돌려주는 충돌 항목(블록·경고 공통 모양). */
export interface ConflictItem {
  code: string;
  message: string;
  /** 사유를 적으면 통과시킬 수 있는가. 경고는 항상 false. */
  overridable: boolean;
  conflictsWith?: string;
}

/** 409로 막힌 배정 시도 — 사유를 받아 재시도하기 위해 화면이 붙잡아 두는 상태. */
export interface PendingOverride {
  input: AssignmentDraft;
  blocked: ConflictItem[];
  warnings: ConflictItem[];
}

export interface AssignmentDraft {
  tourDate: string;
  tourType: string;
  role: string;
  amountKrw: number | null;
  note: string;
  startTime: string | null;
  endTime: string | null;
}

export interface ResolvedRateRow {
  tourType: string;
  amountKrw: number;
  scope: 'guide' | 'default';
  effectiveFrom: string;
  rowId: string | null;
  note: string | null;
}
