import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { handleApiError, ErrorResponses } from "@/lib/error-handler";
import { getCmsContentOverridesFromDb } from "@/lib/cms-content.server";

export const dynamic = "force-dynamic";

/** GET /api/admin/cms — raw CMS overrides (admin). */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const overrides = await getCmsContentOverridesFromDb();
    return NextResponse.json({ success: true, overrides });
  } catch (error: unknown) {
    const err = error as { message?: string };
    if (err.message === "Unauthorized" || String(err.message).includes("Forbidden")) {
      return ErrorResponses.forbidden("Admin access required");
    }
    return handleApiError(error);
  }
}
