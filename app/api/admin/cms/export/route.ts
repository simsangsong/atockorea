import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { handleApiError, ErrorResponses } from "@/lib/error-handler";
import { buildEffectiveCmsExport } from "@/lib/cms-content.server";
import { normalizeLocaleQueryParam } from "@/lib/locale";
import { isCmsPageBundleId, CMS_PAGE_BUNDLES } from "@/lib/cms-page-bundles";
import { filterExportByPageBundle } from "@/lib/cms-page-filter";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/cms/export — full effective JSON (all locales) for translators.
 * ?locale=ko — only that locale in messages + siteCopy.
 * ?page=main — 메인/마이페이지 등 페이지 번들에 해당하는 키만 포함.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const { messages, siteCopy, sectionImages } = await buildEffectiveCmsExport();
    const oneRaw = request.nextUrl.searchParams.get("locale");
    const one = normalizeLocaleQueryParam(oneRaw);
    let messagesOut: Record<string, unknown> =
      one
        ? { [one]: (messages as Record<string, unknown>)[one] }
        : (messages as Record<string, unknown>);
    let siteCopyOut: Record<string, unknown> =
      one
        ? { [one]: (siteCopy as Record<string, unknown>)[one] }
        : (siteCopy as Record<string, unknown>);

    const pageParam = request.nextUrl.searchParams.get("page");
    let sectionImagesOut: Record<string, unknown> = sectionImages as Record<string, unknown>;
    let pageBundle: string | null = null;

    if (pageParam && isCmsPageBundleId(pageParam)) {
      pageBundle = pageParam;
      const filtered = filterExportByPageBundle(messagesOut, siteCopyOut, pageParam);
      messagesOut = filtered.messages;
      siteCopyOut = filtered.siteCopy;
      if (!CMS_PAGE_BUNDLES[pageParam].includeSectionImages) {
        sectionImagesOut = {};
      }
    }

    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      localeFilter: one ?? null,
      pageBundle,
      messages: messagesOut,
      siteCopy: siteCopyOut,
      sectionImages: sectionImagesOut,
    };
    const suffixLocale = one ?? "all";
    const suffixPage = pageBundle ? `-${pageBundle}` : "";
    const filename = `atockorea-cms-export${suffixPage}-${suffixLocale}-${new Date().toISOString().slice(0, 10)}.json`;
    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    if (err.message === "Unauthorized" || String(err.message).includes("Forbidden")) {
      return ErrorResponses.forbidden("Admin access required");
    }
    return handleApiError(error);
  }
}
