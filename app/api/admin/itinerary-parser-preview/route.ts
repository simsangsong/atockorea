/**
 * Admin-only debug route for the parser-first + SQL-first itinerary architecture.
 *
 * POST /api/admin/itinerary-parser-preview
 *
 * Purpose:
 * - Allows operators and developers to test the deterministic parser + SQL candidate
 *   query without touching the current /api/itinerary/generate route.
 * - Does NOT change any existing API response contracts.
 * - Protected by requireAdmin (same pattern as all other /api/admin/* routes).
 *
 * Request body:
 *   { text: string; locale?: "ko" | "en"; limit?: number; persist?: boolean }
 *
 * Response:
 *   { parsed: DeterministicParserResult; candidates: LeanPoiCandidate[]; requestProfileId; parseLogId; persistenceError }
 *
 * This route will be removed or promoted once the full route replacement is done.
 */
import { NextRequest, NextResponse } from 'next/server';
import { AdminAuthFailure, adminAuthJsonResponse, requireAdmin } from '@/lib/auth';
import { runParserPreview } from '@/lib/itinerary/reco/run-parser-preview';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);

    const body = await req.json().catch(() => ({})) as {
      text?: unknown;
      locale?: unknown;
      limit?: unknown;
      persist?: unknown;
    };

    const rawText = typeof body.text === 'string' ? body.text.trim() : '';
    if (!rawText) {
      return NextResponse.json(
        { ok: false, code: 'MISSING_TEXT', message: '"text" field is required' },
        { status: 400 },
      );
    }

    const locale =
      body.locale === 'en' ? 'en'
      : body.locale === 'ko' ? 'ko'
      : 'ko';

    const rawLimit = Number(body.limit);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 120) : 20;

    // persist defaults to false for this debug route to avoid polluting logs
    // during development. Set persist: true in the request body to test persistence.
    const persist = body.persist === true;

    const result = await runParserPreview(rawText, locale, limit, persist);

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    console.error('[api/admin/itinerary-parser-preview]', e);
    return NextResponse.json(
      {
        ok: false,
        code: 'INTERNAL',
        message: e instanceof Error ? e.message : 'Request failed',
      },
      { status: 500 },
    );
  }
}
