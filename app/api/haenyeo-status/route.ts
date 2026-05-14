/**
 * Live haenyeo show status proxy.
 *
 * Source: haenyeoshow.com is a SPA that reads from a public Firebase Realtime
 * Database (path `/status` + `/notice`). We hit the Firebase REST endpoint
 * server-side so the browser doesn't need to load the Firebase SDK or face
 * CORS issues, and we get a small, predictable JSON shape.
 *
 * Status values (from haenyeoshow.com app.js STATUS_MAP):
 *   - "normal"    → green   "정상 진행"     / "On Schedule"
 *   - "pending"   → orange  "아직 미정"     / "Not Confirmed Yet"
 *   - "cancelled" → red     "취소 확정"     / "Canceled"
 *   - "unknown"   → gray    "문의 전"       / "Not Checked Yet"
 */

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const STATUS_DB = "https://haenyeo-default-rtdb.asia-southeast1.firebasedatabase.app/status.json";
const NOTICE_DB = "https://haenyeo-default-rtdb.asia-southeast1.firebasedatabase.app/notice.json";
const SOURCE_URL = "https://www.haenyeoshow.com/";

const STATUS_COLORS = {
  normal: "green",
  pending: "orange",
  cancelled: "red",
  unknown: "gray",
} as const;

type StatusKey = keyof typeof STATUS_COLORS;

const STATUS_LABELS: Record<StatusKey, { ko: string; en: string }> = {
  normal: { ko: "정상 진행", en: "On Schedule" },
  pending: { ko: "아직 미정", en: "Not Confirmed Yet" },
  cancelled: { ko: "취소 확정", en: "Canceled" },
  unknown: { ko: "문의 전", en: "Not Checked Yet" },
};

function isStatusKey(v: unknown): v is StatusKey {
  return typeof v === "string" && v in STATUS_COLORS;
}

async function fetchJson<T>(url: string, timeoutMs = 4000): Promise<T | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  const [statusDoc, noticeDoc] = await Promise.all([
    fetchJson<{ current?: string; updatedAt?: number }>(STATUS_DB),
    fetchJson<{ text?: string; updatedAt?: number }>(NOTICE_DB),
  ]);

  const raw = statusDoc?.current;
  const status: StatusKey = isStatusKey(raw) ? raw : "unknown";

  return NextResponse.json(
    {
      status,
      color: STATUS_COLORS[status],
      label: STATUS_LABELS[status],
      updatedAt: statusDoc?.updatedAt ?? null,
      notice: noticeDoc?.text?.trim() ? noticeDoc.text.trim() : null,
      noticeUpdatedAt: noticeDoc?.updatedAt ?? null,
      sourceUrl: SOURCE_URL,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
}
