'use client';

/**
 * W3 — shared types + tiny utilities for the ops-center app. The row shapes
 * mirror /api/admin/tour-ops/rooms exactly; the token/sound helpers moved
 * here from the v1 page so every tab can use them.
 */

import { supabase } from '@/lib/supabase';

export interface SosMetadata {
  latitude?: number;
  longitude?: number;
  note?: string;
  sender_name?: string;
}

export interface OpsBooking {
  id?: string;
  contact_name: string | null;
  contact_phone?: string | null;
  number_of_guests: number | null;
  preferred_language: string | null;
  status?: string;
}

export interface OpsParticipant {
  room_id?: string;
  role: string;
  display_name: string;
  locale?: string | null;
  last_seen_at: string | null;
}

export interface OpsRoom {
  id: string;
  booking_id: string;
  tour_id?: string | null;
  tour_date?: string;
  status: string;
  booking: OpsBooking | null;
  tour: { id?: string; title: string; city?: string | null } | null;
  participants: OpsParticipant[];
  message_count: number;
  last_message: {
    id?: string;
    source_text?: string;
    sender_role?: string;
    created_at?: string;
    translations?: Record<string, string> | null;
    metadata?: Record<string, unknown> | null;
  } | null;
  sos: { metadata?: SosMetadata; created_at?: string } | null;
  onboard_ack?: boolean;
}

/** An active SOS for a room — aggregate row or live broadcast, whichever is newer. */
export interface SosInfo {
  metadata: SosMetadata;
  created_at?: string;
}

export async function getOpsToken(): Promise<string> {
  const sess = await supabase?.auth.getSession();
  const token = sess?.data.session?.access_token;
  if (!token) throw new Error('세션이 만료되었습니다. 다시 로그인하세요.');
  return token;
}

/** Short two-tone alert via WebAudio — no asset needed (v1, T7.2). */
export function playSosSound() {
  try {
    type Ctor = new () => AudioContext;
    const Ctx =
      (window as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor }).AudioContext ??
      (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    for (const [freq, at] of [[880, 0], [660, 0.18], [880, 0.36]] as const) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.12, ctx.currentTime + at);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + at + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + at);
      osc.stop(ctx.currentTime + at + 0.17);
    }
  } catch {
    /* sound is a bonus */
  }
}

export const SENDER_LABELS: Record<string, string> = {
  customer: '손님',
  guide: '가이드',
  admin: '관제',
  system: '시스템',
};

export function senderLabel(role: string | undefined): string {
  return SENDER_LABELS[role ?? ''] ?? '시스템';
}

/**
 * The Korean-facing text an ops agent should read: the ko translation when the
 * message carries one, else the original. A JA/ES customer's message would
 * otherwise reach the Korean console untranslated (W3 sends are translated, so
 * receipts must be too).
 */
export function opsReadableText(message: {
  source_text?: string;
  translations?: Record<string, string> | null;
} | null | undefined): string {
  if (!message) return '';
  return message.translations?.ko || message.source_text || '';
}

/** "HH:MM" in KST for feed timestamps. */
export function kstTimeLabel(iso: string | undefined): string {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Seoul',
    }).format(new Date(iso));
  } catch {
    return '';
  }
}

/** Activity within the last N minutes → the room counts as live. */
export function isRecent(iso: string | undefined | null, minutes = 10): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  return Number.isFinite(t) && Date.now() - t < minutes * 60_000;
}
