// Shared event types for the L0-L4 funnel + post-processing steps.
// Kept in a tiny module so peripheral utilities (canonicalize-backstop, rules)
// can emit events without pulling in the full funnel + LLM + Supabase graph.

export type FunnelEventName =
  | 'file_ingest_done'
  | 'l0_start' | 'l0_done'
  | 'l1_start' | 'l1_done'
  | 'l1_5_columns_done'
  | 'l2_start' | 'l2_done'
  | 'l3_start' | 'l3_done'
  | 'l4_start' | 'l4_done'
  | 'resegment_done'
  | 'gate_done'
  | 'row_cache_done'
  | 'l3_enrichment_start' | 'l3_enrichment_done'
  | 'canonicalize_start' | 'canonicalize_done'
  | 'cruise_ship_resolve_start' | 'cruise_ship_resolve_done' | 'cruise_ship_lifted_from_pickup'
  | 'cruise_date_infer_start' | 'cruise_date_infer_done'
  | 'cruise_port_call_resolve_start' | 'cruise_port_call_resolve_done'
  | 'tour_date_default_done'
  | 'rules_start' | 'rules_done'
  | 'shadow_rules_scored'
  | 'persist_start' | 'persist_done'
  | 'format_fingerprint'
  | 'format_template_recorded'
  | 'section_header_inherited'
  | 'section_date_inherited'
  | 'noise_filtered'
  | 'whatsapp_inferred_from_phone'
  | 'contact_cc_propagated'
  | 'autopilot_triggered'
  | 'complete' | 'error'

export interface FunnelEvent {
  event: FunnelEventName
  data: Record<string, unknown>
}
