/**
 * 크루즈 선석배정 동기화 (docs/cruise-jeju-shore-excursion-2026.md 후속).
 *
 * 제주도청 크루즈 선석배정의 엑셀 export(HTML 테이블, pageSize=무제한)를 받아
 * `cruise_calls`로 밀어 넣는다. D-1 안내 프리필({cruise_ship} {cruise_arrive}
 * {cruise_depart} {cruise_return_by})의 데이터 소스.
 *
 * 동기화 전략 — **오늘 이후 전량 교체**: 선석배정은 취소·변경이 잦아 upsert만
 * 하면 취소된 기항이 유령으로 남는다. 과거 행은 이력으로 보존하고, 오늘(KST)
 * 이후 구간은 delete → insert 로 export를 그대로 미러링한다.
 *
 * 실행:  npx tsx scripts/sync-cruise-schedule.ts          (라이브 반영)
 *        npx tsx scripts/sync-cruise-schedule.ts --dry    (파싱 결과만 출력)
 * 권장 주기: 월 1회 이상 + 기항 성수기(9~10월)엔 격주.
 */

import { loadEnvConfig } from '@next/env';
import { createClient } from '@supabase/supabase-js';
import { kstToday } from '../lib/tour-room/time';
import { portOfBerth } from '../lib/ops/cruise/schedule';

loadEnvConfig(process.cwd());

const EXPORT_URL =
  'https://www.jeju.go.kr/group/part11/cruise.htm?page=1&_layout=xls&_view=null&_mview=index.xls&pageSize=99999999';

interface ParsedCall {
  call_date: string;
  berth: string;
  port: string;
  ship: string;
  arrive_at: string;
  depart_at: string;
  stay_hours: number | null;
  gross_tonnage: number | null;
  passengers: number | null;
  origin_port: string | null;
  prev_port: string | null;
  next_port: string | null;
}

/** '2026-01-04 13:00' (KST 벽시계) → '+09:00' 타임스탬프 문자열. */
function kstStamp(raw: string): string | null {
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})$/);
  return m ? `${m[1]}T${m[2]}:00+09:00` : null;
}

function stripTags(cell: string): string {
  return cell
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseBerthExport(html: string): ParsedCall[] {
  const out: ParsedCall[] = [];
  for (const tr of html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? []) {
    const cells = (tr.match(/<td[^>]*>[\s\S]*?<\/td>/g) ?? []).map(stripTags);
    // 연도 / 배정(선석) / 선명 / 입항일 / 출항일 / 체류시간 / 톤수 / 정원 / 최초출발항 / 이전항 / 다음항
    if (cells.length !== 11) continue;
    const arrive = kstStamp(cells[3]);
    const depart = kstStamp(cells[4]);
    if (!arrive || !depart || !cells[2]) continue;
    const num = (v: string) => {
      const n = Number(v.replace(/[^\d.]/g, ''));
      return Number.isFinite(n) && v.trim() !== '' ? n : null;
    };
    out.push({
      call_date: cells[3].slice(0, 10),
      berth: cells[1],
      port: portOfBerth(cells[1]),
      ship: cells[2],
      arrive_at: arrive,
      depart_at: depart,
      stay_hours: num(cells[5]),
      gross_tonnage: num(cells[6]) === null ? null : Math.round(num(cells[6])!),
      passengers: num(cells[7]) === null ? null : Math.round(num(cells[7])!),
      origin_port: cells[8] || null,
      prev_port: cells[9] || null,
      next_port: cells[10] || null,
    });
  }
  return out;
}

async function main() {
  const dry = process.argv.includes('--dry');
  const res = await fetch(EXPORT_URL);
  if (!res.ok) throw new Error(`export fetch failed: ${res.status}`);
  const html = await res.text();
  const calls = parseBerthExport(html);
  if (calls.length < 100) {
    // 도청이 포맷을 바꾸면 0~수십 행으로 무너진다 — 그 상태로 delete를 치면
    // 미래 일정이 통째로 사라지므로, 임계 미달이면 아무것도 지우지 않는다.
    throw new Error(`parsed only ${calls.length} rows — export format may have changed; aborting before delete`);
  }

  const today = kstToday();
  const future = calls.filter((c) => c.call_date >= today);
  console.log(`parsed ${calls.length} rows · future(≥${today}) ${future.length}`);
  if (dry) {
    console.log(future.slice(0, 5));
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY required');
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const del = await supabase.from('cruise_calls').delete().gte('call_date', today);
  if (del.error) throw new Error(`delete failed: ${del.error.message}`);
  for (let i = 0; i < future.length; i += 200) {
    const chunk = future.slice(i, i + 200);
    const ins = await supabase.from('cruise_calls').insert(chunk);
    if (ins.error) throw new Error(`insert failed at ${i}: ${ins.error.message}`);
  }
  const { count } = await supabase
    .from('cruise_calls')
    .select('id', { count: 'exact', head: true })
    .gte('call_date', today);
  console.log(`synced — future rows in db: ${count}`);
}

// CLI로 직접 실행했을 때만 돈다 — jest가 parseBerthExport를 import할 때
// 네트워크/DB를 건드리면 안 된다.
if (process.argv[1] && /sync-cruise-schedule/.test(process.argv[1])) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
