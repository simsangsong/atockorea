import "server-only";
import { createServerClient } from "@/lib/supabase";
import type { CmsContentOverrides } from "@/lib/cms-content.types";
import { deepMerge } from "@/lib/deep-merge";
import type { Locale } from "@/lib/locale";
import { locales } from "@/lib/locale";
import { loadBaselineMessages, loadBaselineSiteCopy } from "@/lib/cms-baseline.server";

const EMPTY: CmsContentOverrides = {};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/**
 * DB/수동 편집에서 `messages.zh-CN`처럼 잘못된 키가 들어간 경우 → `zh`로 합침 (앱 Locale 키와 일치).
 */
function normalizeOverridesLocaleKeys(raw: CmsContentOverrides): CmsContentOverrides {
  const out: CmsContentOverrides = { ...raw };
  const fix = (section: Partial<Record<Locale, Record<string, unknown>>> | undefined) => {
    if (!section || !isPlainObject(section)) return section;
    const s = { ...section } as Record<string, Record<string, unknown>>;
    const wrong = s["zh-CN"];
    if (wrong !== undefined && isPlainObject(wrong) && s.zh === undefined) {
      s.zh = wrong;
      delete s["zh-CN"];
    }
    return s as Partial<Record<Locale, Record<string, unknown>>>;
  };
  out.messages = fix(out.messages);
  out.siteCopy = fix(out.siteCopy);
  if (out.weatherTourAdvisories && isPlainObject(out.weatherTourAdvisories)) {
    const s = { ...out.weatherTourAdvisories } as Record<string, unknown>;
    const wrong = s["zh-CN"];
    if (wrong !== undefined && isPlainObject(wrong) && s.zh === undefined) {
      s.zh = wrong;
      delete s["zh-CN"];
    }
    out.weatherTourAdvisories = s as CmsContentOverrides["weatherTourAdvisories"];
  }
  return out;
}

export async function getCmsContentOverridesFromDb(): Promise<CmsContentOverrides> {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("site_settings")
      .select("cms_content_overrides")
      .eq("id", "default")
      .maybeSingle<{ cms_content_overrides: CmsContentOverrides | null }>();

    if (error) {
      console.error("[getCmsContentOverridesFromDb]", error);
      return { ...EMPTY };
    }
    if (!data) {
      return { ...EMPTY };
    }
    const raw = data.cms_content_overrides;
    if (raw == null) {
      return { ...EMPTY };
    }
    if (typeof raw !== "object" || Array.isArray(raw)) {
      return { ...EMPTY };
    }
    return normalizeOverridesLocaleKeys(raw as CmsContentOverrides);
  } catch {
    return { ...EMPTY };
  }
}

export async function saveCmsContentOverridesToDb(overrides: CmsContentOverrides): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createServerClient();
    /** upsert: `default` 행이 없으면 update 0건으로 조용히 실패하는 경우 방지 */
    const { error } = await supabase.from("site_settings").upsert(
      {
        id: "default",
        cms_content_overrides: overrides as unknown as Record<string, unknown>,
      },
      { onConflict: "id" },
    );
    if (error) {
      console.error("[saveCmsContentOverridesToDb]", error);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return { ok: false, error: msg };
  }
}

/** Effective merged trees for API export (translators see full strings). */
export async function buildEffectiveCmsExport(): Promise<{
  messages: Record<string, unknown>;
  siteCopy: Record<string, unknown>;
  sectionImages: Record<string, string>;
}> {
  const [baselineMsg, baselineSc, db] = await Promise.all([
    loadBaselineMessages(),
    loadBaselineSiteCopy(),
    getCmsContentOverridesFromDb(),
  ]);

  const messages: Record<string, unknown> = {};
  const siteCopy: Record<string, unknown> = {};

  for (const loc of locales) {
    const mo = db.messages?.[loc];
    const so = db.siteCopy?.[loc];
    messages[loc] = mo
      ? deepMerge(
          { ...(baselineMsg[loc] as Record<string, unknown>) },
          mo as Record<string, unknown>,
        )
      : (baselineMsg[loc] as Record<string, unknown>);
    siteCopy[loc] = so
      ? deepMerge(
          { ...(baselineSc[loc] as Record<string, unknown>) },
          so as Record<string, unknown>,
        )
      : (baselineSc[loc] as Record<string, unknown>);
  }

  const sectionImages = { ...(db.sectionImages ?? {}) };

  return { messages, siteCopy, sectionImages };
}
