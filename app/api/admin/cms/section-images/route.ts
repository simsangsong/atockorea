import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { handleApiError, ErrorResponses } from "@/lib/error-handler";
import {
  getCmsContentOverridesFromDb,
  saveCmsContentOverridesToDb,
} from "@/lib/cms-content.server";
import type { CmsContentOverrides } from "@/lib/cms-content.types";
import { isAllowedHomepageImageUrl } from "@/lib/homepage-product-card-images.shared";

export const dynamic = "force-dynamic";

type Body = { sectionImages?: Record<string, string | null> };

/**
 * PUT /api/admin/cms/section-images — merge section image URLs (empty string clears key).
 */
export async function PUT(request: NextRequest) {
  try {
    await requireAdmin(request);
    const body = (await request.json()) as Body;
    if (!body.sectionImages || typeof body.sectionImages !== "object") {
      return NextResponse.json({ success: false, error: "sectionImages object required" }, { status: 400 });
    }

    const current = await getCmsContentOverridesFromDb();
    const merged: Record<string, string> = { ...(current.sectionImages ?? {}) };

    for (const [k, v] of Object.entries(body.sectionImages)) {
      if (v === null || v === "") {
        delete merged[k];
        continue;
      }
      const s = String(v).trim();
      if (!isAllowedHomepageImageUrl(s)) {
        return NextResponse.json(
          { success: false, error: `Invalid URL for ${k}: use /path or http(s)` },
          { status: 400 },
        );
      }
      merged[k] = s;
    }

    const next: CmsContentOverrides = {
      ...current,
      sectionImages: merged,
    };

    const saved = await saveCmsContentOverridesToDb(next);
    if (!saved.ok) {
      return NextResponse.json({ success: false, error: saved.error ?? "Save failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true, sectionImages: merged });
  } catch (error: unknown) {
    const err = error as { message?: string };
    if (err.message === "Unauthorized" || String(err.message).includes("Forbidden")) {
      return ErrorResponses.forbidden("Admin access required");
    }
    return handleApiError(error);
  }
}
