// Read/write helpers for parse_format_templates.
//
// Reads are tenant-scoped (RLS does the rest), writes use the service-role
// client because we record drafts inside best-effort post-funnel paths where
// we don't want a missing RLS grant to fail the import.

import type { SupabaseClient } from '@supabase/supabase-js'
// atockorea port: kursoflow's createServiceClient (service-role client) maps to
// createServerClient in lib/supabase.ts — aliased to keep call sites verbatim.
import { createServerClient as createServiceClient } from '@/lib/supabase'
import type { FormatFingerprint } from './format-fingerprint'
import type { ParsedBooking, ImportRequestSource } from '@/lib/ops/parse/types'

const SAMPLE_INPUT_MAX_CHARS = 2000

export interface FormatTemplateRow {
  id: string
  tenant_id: string | null
  fingerprint: string
  name: string | null
  format_kind: 'spreadsheet' | 'text' | 'mixed'
  status: 'draft' | 'active' | 'rejected'
  header_columns: string[] | null
  shape_signature: string | null
  column_mapping: Record<string, { columnIndex: number; transform?: string }> | null
  hit_count: number
  success_count: number
  last_hit_at: string | null
  source_platform: string | null
}

/** Look up the best active template for a fingerprint. Falls back to global
 *  templates (tenant_id IS NULL) if no tenant-local row matches.
 *  Status filter is forced to 'active' — drafts/rejected never apply. */
export async function lookupActiveTemplate(
  supabase: SupabaseClient,
  tenantId: string,
  fingerprint: string,
): Promise<FormatTemplateRow | null> {
  const { data } = await supabase
    .from('ops_parse_format_templates')
    .select('id, tenant_id, fingerprint, name, format_kind, status, header_columns, shape_signature, column_mapping, hit_count, success_count, last_hit_at, source_platform')
    .eq('fingerprint', fingerprint)
    .eq('status', 'active')
    .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
    .order('tenant_id', { ascending: true, nullsFirst: false }) // tenant-local first
    .limit(1)
  const row = (data?.[0] ?? null) as FormatTemplateRow | null
  return row
}

/** Look up ANY template (draft/active/rejected) for fingerprint — used by the
 *  draft path to skip recording when we already have an entry. */
export async function lookupAnyTemplate(
  supabase: SupabaseClient,
  tenantId: string,
  fingerprint: string,
): Promise<FormatTemplateRow | null> {
  const { data } = await supabase
    .from('ops_parse_format_templates')
    .select('id, tenant_id, fingerprint, name, format_kind, status, header_columns, shape_signature, column_mapping, hit_count, success_count, last_hit_at, source_platform')
    .eq('fingerprint', fingerprint)
    .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
    .order('tenant_id', { ascending: true, nullsFirst: false })
    .limit(1)
  const row = (data?.[0] ?? null) as FormatTemplateRow | null
  return row
}

/**
 * Parser-autopilot dedup marker: a minimal draft row that records "we already
 * dispatched the autopilot for this novel fingerprint", so a 0-parse (or
 * LLM-down deterministic-partial) novel failure — which recordDraftTemplate
 * SKIPS (it needs bookings) — still leaves a template that lookupAnyTemplate
 * hits, blocking re-dispatch on every re-upload. status='draft' so it is NEVER
 * matched by lookupActiveTemplate (deterministic parse behavior is unchanged).
 * No-op if any template already exists for the fingerprint. Best-effort.
 */
export async function recordAutopilotMarker(input: {
  tenantId: string
  fingerprint: FormatFingerprint
}): Promise<void> {
  const { tenantId, fingerprint } = input
  try {
    const service = createServiceClient()
    // Existing recheck (same guard as recordDraftTemplate) — race mitigation.
    const { data: existing } = await service
      .from('ops_parse_format_templates')
      .select('id')
      .eq('fingerprint', fingerprint.fingerprint)
      .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
      .maybeSingle()
    if (existing) return

    await service.from('ops_parse_format_templates').insert({
      tenant_id: tenantId,
      fingerprint: fingerprint.fingerprint,
      format_kind: fingerprint.kind,
      header_columns: fingerprint.headerColumns ?? null,
      shape_signature: fingerprint.shapeSignature ?? null,
      name: 'autopilot:novel-failure',
      column_mapping: null,
      status: 'draft',
      hit_count: 1,
      success_count: 0,
      last_hit_at: new Date().toISOString(),
    })
  } catch {
    // best-effort
  }
}

/** Bump hit_count + last_hit_at on a known template row. Best-effort. */
export async function bumpTemplateHit(
  templateId: string,
  succeeded: boolean,
): Promise<void> {
  try {
    const service = createServiceClient()
    // Two-step: read then write (no atomic increment in supabase-js). Race
    // window is fine — hit_count is observational, not a primary key.
    const { data } = await service
      .from('ops_parse_format_templates')
      .select('hit_count, success_count')
      .eq('id', templateId)
      .maybeSingle()
    if (!data) return
    await service
      .from('ops_parse_format_templates')
      .update({
        hit_count: (data.hit_count ?? 0) + 1,
        success_count: (data.success_count ?? 0) + (succeeded ? 1 : 0),
        last_hit_at: new Date().toISOString(),
      })
      .eq('id', templateId)
  } catch {
    // best-effort
  }
}

/** Record a draft template for a brand-new fingerprint after a successful
 *  LLM run. No-op if a template already exists for this fingerprint (any
 *  status — draft/active/rejected). Best-effort. */
export async function recordDraftTemplate(input: {
  tenantId: string
  fingerprint: FormatFingerprint
  sampleInput: string
  bookings: ParsedBooking[]
  platform: ImportRequestSource
}): Promise<void> {
  const { tenantId, fingerprint, sampleInput, bookings, platform } = input
  if (bookings.length === 0) return

  try {
    const service = createServiceClient()

    // Skip if already known (draft/active/rejected).
    const { data: existing } = await service
      .from('ops_parse_format_templates')
      .select('id')
      .eq('fingerprint', fingerprint.fingerprint)
      .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
      .maybeSingle()
    if (existing) return

    const trimmedSample = sampleInput.length > SAMPLE_INPUT_MAX_CHARS
      ? sampleInput.slice(0, SAMPLE_INPUT_MAX_CHARS) + '\n…[truncated]'
      : sampleInput

    await service.from('ops_parse_format_templates').insert({
      tenant_id: tenantId,
      fingerprint: fingerprint.fingerprint,
      format_kind: fingerprint.kind,
      header_columns: fingerprint.headerColumns ?? null,
      shape_signature: fingerprint.shapeSignature ?? null,
      sample_input: trimmedSample,
      source_platform: typeof platform === 'string' ? platform : null,
      column_mapping: null, // populated by the admin on promotion
      status: 'draft',
      hit_count: 1,
      success_count: 1,
      last_hit_at: new Date().toISOString(),
    })
  } catch {
    // best-effort
  }
}
