import { NextResponse } from "next/server";
import { getCmsContentOverridesFromDb } from "@/lib/cms-content.server";

export const dynamic = "force-dynamic";

/**
 * Public: CMS overrides only (merged on client with static baselines).
 */
export async function GET() {
  try {
    const overrides = await getCmsContentOverridesFromDb();
    return NextResponse.json(
      { success: true, overrides },
      {
        headers: {
          "Cache-Control": "private, no-store, max-age=0, must-revalidate",
        },
      },
    );
  } catch (e: unknown) {
    console.error("[GET /api/cms/content]", e);
    return NextResponse.json(
      { success: false, overrides: {} },
      {
        status: 200,
        headers: {
          "Cache-Control": "private, no-store, max-age=0, must-revalidate",
        },
      },
    );
  }
}
