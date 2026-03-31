import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { handleApiError, ErrorResponses } from "@/lib/error-handler";
import {
  getCmsContentOverridesFromDb,
  saveCmsContentOverridesToDb,
} from "@/lib/cms-content.server";
import { loadBaselineMessages, loadBaselineSiteCopy } from "@/lib/cms-baseline.server";
import { computeDiffFromBaseline, deepMerge } from "@/lib/deep-merge";
import type { CmsContentOverrides } from "@/lib/cms-content.types";
import { locales, type Locale, normalizeLocaleQueryParam } from "@/lib/locale";
import { isCmsPageBundleId, CMS_PAGE_BUNDLES } from "@/lib/cms-page-bundles";
import { filterImportBodyByPageBundle } from "@/lib/cms-page-filter";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 2_000_000;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/** JSON에 `zh-CN` 최상위 키가 있으면 앱 로케일 `zh`로 맞춤 (수동 편집·외부 도구). */
function normalizeImportBodyLocaleKeys(body: ImportBody): ImportBody {
  const out: ImportBody = { ...body };
  const fix = (section: Record<string, unknown> | undefined) => {
    if (!section) return;
    if (section["zh-CN"] !== undefined && section.zh === undefined) {
      section.zh = section["zh-CN"];
      delete section["zh-CN"];
    }
  };
  if (out.messages) fix(out.messages as Record<string, unknown>);
  if (out.siteCopy) fix(out.siteCopy as Record<string, unknown>);
  return out;
}

type ImportBody = {
  messages?: Record<string, unknown>;
  siteCopy?: Record<string, unknown>;
  sectionImages?: Record<string, unknown>;
  /** 추출 시 어떤 페이지 번들인지 표시(메타). 적용 로직은 항상 병합. */
  pageBundle?: string;
};

/** baseline + DB 오버라이드 + 붙여넣은 JSON(전체 또는 페이지 일부) */
function mergePageImportTree(
  baseline: unknown,
  currentOverride: Record<string, unknown> | undefined,
  partialImport: unknown,
): unknown {
  const b =
    baseline && typeof baseline === "object" && baseline !== null
      ? (JSON.parse(JSON.stringify(baseline)) as Record<string, unknown>)
      : {};
  if (!isPlainObject(partialImport)) return partialImport;
  const eff = deepMerge(b, currentOverride ?? {});
  return deepMerge(eff, partialImport);
}

/**
 * 영어(en)만 있는 추출본을 번역한 뒤, 적용 언어로 저장할 때:
 * messages/siteCopy에 target 키가 없고 en만 있으면 en 내용을 target으로 복사한 뒤 en은 제거(이번 요청에서 en 갱신 안 함).
 */
function remapImportBodyByApplyLocale(body: ImportBody, applyLocale: string | null): ImportBody {
  if (!applyLocale || !locales.includes(applyLocale as Locale)) return body;
  const target = applyLocale as Locale;
  if (target === "en") return body;

  const out: ImportBody = { ...body };
  if (out.messages && isPlainObject(out.messages)) {
    const m = { ...out.messages } as Record<string, unknown>;
    if (m[target] === undefined && m.en !== undefined) {
      m[target] = JSON.parse(JSON.stringify(m.en));
      delete m.en;
    }
    out.messages = m;
  }
  if (out.siteCopy && isPlainObject(out.siteCopy)) {
    const s = { ...out.siteCopy } as Record<string, unknown>;
    if (s[target] === undefined && s.en !== undefined) {
      s[target] = JSON.parse(JSON.stringify(s.en));
      delete s.en;
    }
    out.siteCopy = s;
  }
  return out;
}

/**
 * POST /api/admin/cms/import — apply edited JSON; stores diffs vs repo baselines.
 * Query: applyLocale=ko — en-only 추출본을 해당 언어로 매핑 후 적용.
 * Query: skipSectionImages=1 — sectionImages 병합 생략(문구만 적용).
 * Query: page=main — 해당 번들에 허용된 messages/siteCopy 키만 적용(나머지 무시). 번들이 이미지 미포함이면 sectionImages 병합도 생략.
 * messages/siteCopy: (repo baseline + 기존 DB 오버라이드 + 입력 JSON) 병합 후 diff 저장.
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
    const len = Number(request.headers.get("content-length") || "0");
    if (len > MAX_BODY_BYTES) {
      return NextResponse.json({ success: false, error: "Body too large (max ~2MB)" }, { status: 400 });
    }

    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json({ success: false, error: "Body too large" }, { status: 400 });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
    }

    if (!isPlainObject(parsed)) {
      return NextResponse.json({ success: false, error: "Root must be an object" }, { status: 400 });
    }

    const applyLocaleParam = normalizeLocaleQueryParam(
      request.nextUrl.searchParams.get("applyLocale"),
    );
    const pageParam = request.nextUrl.searchParams.get("page");
    const skipSectionImagesQuery =
      request.nextUrl.searchParams.get("skipSectionImages") === "1" ||
      request.nextUrl.searchParams.get("skipSectionImages") === "true";

    let body = parsed as ImportBody;
    body = normalizeImportBodyLocaleKeys(body);
    body = remapImportBodyByApplyLocale(body, applyLocaleParam ?? "");

    if (pageParam && isCmsPageBundleId(pageParam)) {
      const filtered = filterImportBodyByPageBundle(
        { messages: body.messages, siteCopy: body.siteCopy },
        pageParam,
      );
      if (filtered.messages !== undefined) {
        body.messages = filtered.messages;
      } else {
        delete body.messages;
      }
      if (filtered.siteCopy !== undefined) {
        body.siteCopy = filtered.siteCopy;
      } else {
        delete body.siteCopy;
      }
    }

    const skipSectionImagesEffective =
      skipSectionImagesQuery ||
      (pageParam !== null &&
        isCmsPageBundleId(pageParam) &&
        !CMS_PAGE_BUNDLES[pageParam].includeSectionImages);

    const [baselineMsg, baselineSc, current] = await Promise.all([
      loadBaselineMessages(),
      loadBaselineSiteCopy(),
      getCmsContentOverridesFromDb(),
    ]);

    const next: CmsContentOverrides = {
      messages: { ...(current.messages ?? {}) },
      siteCopy: { ...(current.siteCopy ?? {}) },
      sectionImages: { ...(current.sectionImages ?? {}) },
    };

    if (body.messages && isPlainObject(body.messages)) {
      for (const loc of locales) {
        if (!Object.prototype.hasOwnProperty.call(body.messages, loc)) continue;
        const edited = body.messages[loc];
        const base = baselineMsg[loc];
        const mergedForDiff = mergePageImportTree(base, current.messages?.[loc], edited);
        const diff = computeDiffFromBaseline(base, mergedForDiff);
        if (diff && isPlainObject(diff) && Object.keys(diff).length > 0) {
          next.messages![loc] = diff as Record<string, unknown>;
        } else {
          delete next.messages![loc];
        }
      }
    }

    if (body.siteCopy && isPlainObject(body.siteCopy)) {
      for (const loc of locales) {
        if (!Object.prototype.hasOwnProperty.call(body.siteCopy, loc)) continue;
        const edited = body.siteCopy[loc];
        const base = baselineSc[loc];
        const mergedForDiff = mergePageImportTree(base, current.siteCopy?.[loc], edited);
        const diff = computeDiffFromBaseline(base, mergedForDiff);
        if (diff && isPlainObject(diff) && Object.keys(diff).length > 0) {
          next.siteCopy![loc] = diff as Record<string, unknown>;
        } else {
          delete next.siteCopy![loc];
        }
      }
    }

    if (!skipSectionImagesEffective && body.sectionImages && isPlainObject(body.sectionImages)) {
      const si: Record<string, string> = {};
      for (const [k, v] of Object.entries(body.sectionImages)) {
        if (typeof v === "string" && v.trim().length > 0) {
          si[k] = v.trim();
        }
      }
      next.sectionImages = { ...next.sectionImages, ...si };
    }

    const stripEmpty = (o: CmsContentOverrides): CmsContentOverrides => {
      const out: CmsContentOverrides = {};
      if (o.messages && Object.keys(o.messages).length > 0) out.messages = o.messages;
      if (o.siteCopy && Object.keys(o.siteCopy).length > 0) out.siteCopy = o.siteCopy;
      if (o.sectionImages && Object.keys(o.sectionImages).length > 0) out.sectionImages = o.sectionImages;
      return out;
    };

    const saved = await saveCmsContentOverridesToDb(stripEmpty(next));
    if (!saved.ok) {
      return NextResponse.json({ success: false, error: saved.error ?? "Save failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "CMS content imported" });
  } catch (error: unknown) {
    const err = error as { message?: string };
    if (err.message === "Unauthorized" || String(err.message).includes("Forbidden")) {
      return ErrorResponses.forbidden("Admin access required");
    }
    return handleApiError(error);
  }
}
