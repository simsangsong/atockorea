"use client";

import { useEffect, useState } from "react";

type StatusKey = "normal" | "pending" | "cancelled" | "unknown";

type StatusResponse = {
  status: StatusKey;
  color: "green" | "orange" | "red" | "gray";
  label: { ko: string; en: string };
  updatedAt: number | null;
  notice: string | null;
  noticeUpdatedAt: number | null;
  sourceUrl: string;
};

type Locale = "en" | "ko" | "ja" | "zh" | "zh-TW" | "es";

const BUTTON_LABEL: Record<Locale, string> = {
  en: "Check today's performance status",
  ko: "오늘 공연 진행 여부 보기",
  ja: "本日の公演実施状況を確認",
  zh: "查看今日演出状态",
  "zh-TW": "查看今日演出狀態",
  es: "Ver estado de la función de hoy",
};

const LOADING_LABEL: Record<Locale, string> = {
  en: "Checking…",
  ko: "확인 중…",
  ja: "確認中…",
  zh: "查询中…",
  "zh-TW": "查詢中…",
  es: "Consultando…",
};

const SOURCE_LINK_LABEL: Record<Locale, string> = {
  en: "Source: haenyeoshow.com",
  ko: "출처: haenyeoshow.com",
  ja: "出典: haenyeoshow.com",
  zh: "来源: haenyeoshow.com",
  "zh-TW": "來源: haenyeoshow.com",
  es: "Fuente: haenyeoshow.com",
};

const ERROR_LABEL: Record<Locale, string> = {
  en: "Couldn't reach the status feed. Try again or visit the source.",
  ko: "상태를 가져오지 못했어요. 다시 시도하거나 출처 사이트를 확인하세요.",
  ja: "状態を取得できませんでした。再試行するか、出典サイトをご確認ください。",
  zh: "无法获取状态。请重试或访问来源网站。",
  "zh-TW": "無法獲取狀態。請重試或前往來源網站。",
  es: "No se pudo obtener el estado. Inténtalo de nuevo o visita la fuente.",
};

// Per-status status-card chrome (color + announcement text)
const CARD_CHROME: Record<StatusKey, { bg: string; border: string; dot: string; text: string }> = {
  normal: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
    text: "text-emerald-900",
  },
  pending: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    dot: "bg-amber-500",
    text: "text-amber-900",
  },
  cancelled: {
    bg: "bg-rose-50",
    border: "border-rose-200",
    dot: "bg-rose-500",
    text: "text-rose-900",
  },
  unknown: {
    bg: "bg-slate-50",
    border: "border-slate-200",
    dot: "bg-slate-400",
    text: "text-slate-700",
  },
};

const LOCALIZED_STATUS_LABEL: Record<Locale, Record<StatusKey, string>> = {
  en: {
    normal: "On schedule — performance will proceed",
    pending: "Not confirmed yet — operator still deciding",
    cancelled: "Canceled — today's show is off",
    unknown: "Not checked yet",
  },
  ko: {
    normal: "정상 진행 예정",
    pending: "아직 미정 (운영자 확인 중)",
    cancelled: "취소 확정 — 오늘 공연 없음",
    unknown: "아직 문의 전",
  },
  ja: {
    normal: "通常通り実施予定",
    pending: "未確定（運営側確認中）",
    cancelled: "中止確定 — 本日公演なし",
    unknown: "未確認",
  },
  zh: {
    normal: "正常进行",
    pending: "尚未确定（运营方确认中）",
    cancelled: "取消确认 — 今日演出取消",
    unknown: "尚未查询",
  },
  "zh-TW": {
    normal: "正常進行",
    pending: "尚未確定（營運方確認中）",
    cancelled: "取消確認 — 今日演出取消",
    unknown: "尚未查詢",
  },
  es: {
    normal: "Confirmada — la función se realizará",
    pending: "Por confirmar (operador aún decidiendo)",
    cancelled: "Cancelada — no hay función hoy",
    unknown: "Sin consultar",
  },
};

function formatTimestamp(ms: number | null, locale: Locale): string {
  if (!ms) return "";
  try {
    return new Intl.DateTimeFormat(locale === "zh-TW" ? "zh-TW" : locale, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Seoul",
    }).format(new Date(ms));
  } catch {
    return "";
  }
}

export function HaenyeoStatusButton({
  locale = "en",
  autoFetch = false,
  variant = "compact",
}: {
  locale?: Locale;
  /** When true, fetches status immediately on mount (used by the persistent
   *  section on the Jeju east tour). When false, the user must click. */
  autoFetch?: boolean;
  /** "compact" = small button. "section" = full-width card with heading,
   *  used for the persistent above-itinerary placement. */
  variant?: "compact" | "section";
}) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function check() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/haenyeo-status", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as StatusResponse;
      setData(json);
    } catch {
      setError(ERROR_LABEL[locale]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (autoFetch) {
      void check();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFetch]);

  const chrome = data ? CARD_CHROME[data.status] : null;
  const statusLabel = data ? LOCALIZED_STATUS_LABEL[locale][data.status] : "";
  const timeStr = data ? formatTimestamp(data.updatedAt, locale) : "";

  const SECTION_HEADING: Record<Locale, string> = {
    en: "Today's Haenyeo Show Status",
    ko: "오늘 해녀쇼 진행 상태",
    ja: "本日の海女ショー実施状況",
    zh: "今日海女演出状态",
    "zh-TW": "今日海女演出狀態",
    es: "Estado de la función de haenyeo de hoy",
  };

  const SECTION_SUBHEAD: Record<Locale, string> = {
    en: "Live feed from haenyeoshow.com — shows run once daily at 14:00 and may be canceled in bad weather.",
    ko: "haenyeoshow.com 실시간 정보 — 공연은 매일 오후 2시 1회, 악천후 시 취소 가능.",
    ja: "haenyeoshow.com のライブ情報 — 公演は1日1回14時、悪天候時は中止の可能性あり。",
    zh: "haenyeoshow.com 实时信息 — 每日下午2点1场，恶劣天气时可能取消。",
    "zh-TW": "haenyeoshow.com 即時資訊 — 每日下午2點1場，惡劣天氣時可能取消。",
    es: "Información en vivo de haenyeoshow.com — 1 función diaria a las 14:00; puede cancelarse por mal tiempo.",
  };

  if (variant === "section") {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight text-slate-900 sm:text-[17px]">
              {SECTION_HEADING[locale]}
            </h2>
            <p className="mt-1 text-[12px] leading-relaxed text-slate-500 sm:text-[12.5px]">
              {SECTION_SUBHEAD[locale]}
            </p>
          </div>
          <button
            type="button"
            onClick={check}
            disabled={loading}
            aria-busy={loading}
            className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1.5 text-[11.5px] font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:opacity-60 shrink-0"
          >
            <span
              aria-hidden
              className={`h-1.5 w-1.5 rounded-full ${loading ? "animate-pulse bg-amber-400" : "bg-emerald-400"}`}
            />
            {loading ? LOADING_LABEL[locale] : (data ? "↻" : BUTTON_LABEL[locale])}
          </button>
        </div>

        {error && (
          <p className="mt-3 text-[12.5px] text-rose-700">{error}</p>
        )}

        {data && chrome && (
          <div className={`mt-3 rounded-xl border ${chrome.border} ${chrome.bg} px-3.5 py-3`}>
            <div className="flex items-start gap-3">
              <span
                aria-hidden
                className={`mt-1 h-3 w-3 flex-shrink-0 rounded-full ${chrome.dot}`}
              />
              <div className="min-w-0 flex-1">
                <p className={`text-[14.5px] font-semibold ${chrome.text}`}>
                  {statusLabel}
                </p>
                {data.notice && (
                  <p className={`mt-1.5 text-[12.5px] leading-relaxed ${chrome.text} opacity-85 whitespace-pre-line`}>
                    {data.notice}
                  </p>
                )}
                {timeStr && (
                  <p className="mt-2 text-[11px] text-slate-500 tabular-nums">
                    {timeStr} KST
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <a
          href="https://www.haenyeoshow.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-[11px] text-slate-500 underline-offset-2 hover:underline"
        >
          {SOURCE_LINK_LABEL[locale]}
        </a>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
      <button
        type="button"
        onClick={check}
        disabled={loading}
        aria-busy={loading}
        className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-[12.5px] font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:opacity-60"
      >
        <span
          aria-hidden
          className={`h-2 w-2 rounded-full ${loading ? "animate-pulse bg-amber-400" : "bg-emerald-400"}`}
        />
        {loading ? LOADING_LABEL[locale] : BUTTON_LABEL[locale]}
      </button>

      {error && (
        <p className="mt-3 text-[12.5px] text-rose-700">
          {error}
        </p>
      )}

      {data && chrome && (
        <div className={`mt-3 rounded-lg border ${chrome.border} ${chrome.bg} px-3 py-2.5`}>
          <div className="flex items-start gap-2.5">
            <span
              aria-hidden
              className={`mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full ${chrome.dot}`}
            />
            <div className="min-w-0 flex-1">
              <p className={`text-[13.5px] font-semibold ${chrome.text}`}>
                {statusLabel}
              </p>
              {data.notice && (
                <p className={`mt-1 text-[12.5px] leading-relaxed ${chrome.text}/85 whitespace-pre-line`}>
                  {data.notice}
                </p>
              )}
              {timeStr && (
                <p className="mt-1.5 text-[11px] text-slate-500 tabular-nums">
                  {timeStr} KST
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <a
        href="https://www.haenyeoshow.com/"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-block text-[11px] text-slate-500 underline-offset-2 hover:underline"
      >
        {SOURCE_LINK_LABEL[locale]}
      </a>
    </div>
  );
}
