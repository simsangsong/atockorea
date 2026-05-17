// POST /api/analytics/identify
// body: { anonymous_id: string, user_id: string }
//
// Called once after successful login so retroactive cohort analysis can
// stitch the user's anonymous browsing history to their authenticated rows.
//
// We verify the caller's session against the provided user_id before
// writing the merge row — clients can't claim arbitrary user_ids.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase";
import { getAuthUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RequestSchema = z.object({
  anonymous_id: z.string().min(8).max(128),
  user_id: z.string().uuid(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = RequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_schema" }, { status: 400 });
  }

  const user = await getAuthUser(req);
  if (!user || user.id !== parsed.data.user_id) {
    // Don't reveal whether the user exists; just refuse the merge.
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const supabase = createServerClient();
  const { error } = await supabase
    .from("analytics_users")
    .upsert(
      {
        anonymous_id: parsed.data.anonymous_id,
        user_id: parsed.data.user_id,
      },
      { onConflict: "anonymous_id" },
    );

  if (error) {
    return NextResponse.json(
      { ok: false, error: "merge_failed", message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
