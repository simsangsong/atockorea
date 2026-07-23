// Phase 0-bis — L2 heuristic extractor
// Master plan §6.1 — regex slot extraction with confidence floor 0.85.
// Only emits a booking when (leadName, partySize, pickup OR contact) are all present.

import type { ParsedBooking, OTASource } from '@/lib/ops/parse/types'

interface HeuristicResult {
  bookings: ParsedBooking[]
  leftover: string[]
}

/**
 * Best-effort line-block extractor. Runs after platform adapters fail to detect.
 * Splits raw on blank lines, attempts slot extraction per block.
 */
export function heuristicExtract(raw: string): HeuristicResult {
  const normalizedRaw = stripChatExportPrefixes(raw)
  const blocks = normalizedRaw.split(/\n\s*\n+/).map(b => b.trim()).filter(b => b.length > 0)
  const bookings: ParsedBooking[] = []
  const leftover: string[] = []
  let currentProduct: string | undefined
  let manualIdx = 1

  for (const block of blocks) {
    if (looksLikeProductHeading(block)) {
      currentProduct = stripProductPrefix(block)
      continue
    }

    let b = parseBlock(block, currentProduct, manualIdx)
    // Fallback: operator-curated multi-line format
    //   "Name [region]? N명 [region]?"  (line 1)
    //   phone / email / country / cruise notes (lines 2+)
    // These score below the 0.85 floor in parseBlock because they lack a
    // booking ref + labeled pickup + tour date, but the first-line shape +
    // contact presence is a strong enough operator-curated signal on its own.
    if (!b) {
      b = parseOperatorMultiLine(block, currentProduct, manualIdx)
    }
    // Additive last resort — bare hand-typed roster (walk-in / Airbnb / agent).
    if (!b) {
      b = parseBareRoster(block, currentProduct, manualIdx)
    }
    if (b) {
      bookings.push(b)
      manualIdx++
    } else {
      leftover.push(block)
    }
  }

  return { bookings, leftover }
}

function stripChatExportPrefixes(raw: string): string {
  return raw
    .split(/\r?\n/)
    .map((line) => {
      const m = line.match(/^\[\s*(?:오전|오후|AM|PM)?\s*\d{1,2}:\d{2},\s*\d{4}\.\s*\d{1,2}\.\s*\d{1,2}\.\s*\]\s*[^:]{1,60}:\s*(.*)$/i)
      if (!m) return line
      const message = m[1].trim()
      return hasBookingSignal(message) ? message : ''
    })
    .join('\n')
}

function hasBookingSignal(message: string): boolean {
  return /(?:[A-Z]{2,5}[-_]?\d{6,12}|BR-\d{8,12}|\d{2}KK\d{8,14}|@|Phone|Email|WhatsApp|왓츠앱|\d{1,2}\s*명|pax|Adults?|롯데|신라|오션|어반|공항|서남쪽|동쪽|남쪽|제주)/i.test(message)
}

// ── operator-curated multi-line fallback ───────────────────────────────────
//
// Handles three families of leftover bookings in bulk-jeju-v3:
//   Format C — "Name N명 [region]" + 전화번호:/크루즈선:/하선 시간: labels
//   Format D — "Name [region] N명" + (Country) line + bare phone + email
//   Format E — "Name [region]? N명" + bare phone +/- email
//
// First-line shape is the gatekeeper. If the first line doesn't carry
// "<chars> <digits> 명", we bail out — this is the same signal §6.1 calls
// out as the "operator roster" marker.
function parseOperatorMultiLine(
  block: string,
  productName: string | undefined,
  manualIdx: number,
): ParsedBooking | null {
  const lines = block.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0)
  if (lines.length < 2) return null

  // Skip KakaoTalk timestamp blocks and pure-header / pure-region lines.
  if (/^\[\s*(오전|오후|AM|PM)?\s*\d{1,2}:\d{2}/.test(lines[0])) return null

  // First line: "<name-tokens> [region]? <N>명 [region]?"
  // Examples: "Linda Fung 4명", "wolfgang roscher 강정 3명",
  //           "Victoria Magbutay 2명 제주항", "QIU YUYU 신라 2명".
  const first = lines[0]
  const m = first.match(/^(.+?)\s+(\d{1,2})\s*명(?:\s+[가-힣]{1,5})?\s*$/)
  if (!m) return null

  let name = m[1].trim()
  // Lazy `.+?` may have swallowed a trailing Hangul region word ("강정",
  // "신라", "롯데"…). Strip it ONLY when the name has Latin chars — a
  // pure-Hangul name should be preserved as-is.
  if (/[A-Za-z]/.test(name) && /\s+[가-힣]{1,5}$/.test(name)) {
    name = name.replace(/\s+[가-힣]{1,5}$/, '').trim()
  }
  // An explicit "이름: <name>" line wins — the first line is then just the
  // "<region> <hotel> N명" header (e.g. "동쪽 신라 2명" + "이름: Karina Audria").
  // v3/v4 operator rosters carry no 이름: label, so this never alters them.
  const nameLabelLine = lines.find(l => /^이름\s*[:：]/.test(l))
  if (nameLabelLine) {
    const labelled = nameLabelLine.replace(/^이름\s*[:：]\s*/, '').trim()
    if (isPlausibleName(labelled)) name = labelled
  }
  if (!isPlausibleName(name)) return null

  const partySize = Math.min(50, parseInt(m[2], 10) || 1)

  // Contact is REQUIRED — without phone OR email this is just a roster note,
  // not a bookable record.
  const phone = extractPhone(lines)
  const email = extractEmail(lines)
  if (!phone && !email) return null

  // Notes: stash cruise / country context for downstream lifecycle, plus
  // any side-channel contacts (WeChat / LINE / Kakao / Zalo / 비고).
  // Phase 26 §44.5.2 — side contacts feed reachability (§41.2) line_id /
  // kakao_id / zalo_id columns and surface on the Step 5 review card.
  const cruiseSignal = extractCruiseShipSignal(lines, productName)
  const countryLine = lines.find(l => /^\([^)]+\)\s*$/.test(l))
  const cruiseShipText = cruiseSignal?.text
  const noteParts: string[] = [...extractCruiseNoteLines(lines, productName)]
  if (countryLine) noteParts.push(`country=${countryLine.slice(1, -1).trim()}`)
  const sideContacts = extractSideContacts(lines)
  if (sideContacts) noteParts.push(sideContacts)
  const notes = compactNoteParts(noteParts)
  const resolvedProductName = extractProductName(lines, productName)

  const language = extractExplicitLanguage(lines) ?? inferLanguage(phone, name)

  const issues: string[] = ['missing_pickup']   // operator format never has labeled pickup
  if (!email && !phone) issues.push('missing_contact')
  else if (!email) issues.push('missing_email')
  else if (!phone) issues.push('missing_phone')

  return {
    sourcePlatform: detectPlatformFromLines(lines),
    externalBookingId: `MANUAL-OP-${manualIdx}`,
    leadName: name,
    partySize,
    tourDate: extractDate(lines),
    productName: resolvedProductName,
    pickupPointRaw: undefined,
    pickupPointNormalized: undefined,
    pickupTime: extractTime(lines),
    email,
    phone,
    whatsapp: extractWhatsApp(lines),
    language,
    notes,
    confidenceScore: 0.86,   // Just above the 0.85 floor — operator-curated.
    issues,
    cruiseShipText,
  }
}

// ── bare hand-typed roster (walk-in / Airbnb / OTA-agent) ───────────────────
//
// Tried only AFTER parseBlock + parseOperatorMultiLine fail, so it is purely
// ADDITIVE — it can only rescue blocks that were already leftover, never change
// what the earlier parsers emit (v1–v5 totals are unaffected: section-header /
// date leftover blocks have no "<name> N명 + contact" and never match).
//
// Shapes (from real rosters):
//   "Faisal AlBurayhi 롯데 1명 faisal@gmail.com" + "Phone number 966-…"
//   "Wang Sihan 롯데 1명" + "Email x@y.com" + "Phone number 86-…"
//   "동쪽 신라 2명" + "이름: Karina Audria" + "+66 …"
//   "Amanda Tebb 오션 2명" + "Email" + "x@y.com" + "Phone number 61-…"
//   "Lesley Lamond 2명" + "x@reply…" + "Phone: +61…"
// Distinct from parseOperatorMultiLine, whose first line must END at "N명".
const ROSTER_REGION = '동쪽|남쪽|서남쪽|서쪽|북쪽|동남쪽|서북쪽|동북쪽|제주항|강정항|부산항|인천항|제주\\s*남쪽|제주\\s*동쪽'
const ROSTER_HOTEL = '롯데시티|롯데|신라면세점|신라|오션|어반|히든|메종'
// Compiled once at module scope — these run per-line/per-block on the hot L2 path,
// so rebuilding them with `new RegExp` per call was a needless recompile tax.
const RE_ROSTER_REGION_PREFIX = new RegExp(`^(?:${ROSTER_REGION})[\\s,]+`, 'u')
const RE_ROSTER_HOTEL_PAX_TRAILER = new RegExp(`[\\s,]*\\(?\\s*(?:${ROSTER_HOTEL})?\\s*\\d{1,2}\\s*명.*$`, 'u')
const RE_ROSTER_REGION_OR_HOTEL_EXACT = new RegExp(`^(?:${ROSTER_REGION}|${ROSTER_HOTEL})$`, 'u')
const RE_ROSTER_HOTEL_CAPTURE = new RegExp(`(${ROSTER_HOTEL})`, 'u')
const RE_ROSTER_REGION_HEADER = new RegExp(`^(?:${ROSTER_REGION})\\s*-\\s*(.+)$`, 'u')
const RE_ROSTER_INLINE_HOTEL_PAX = new RegExp(`^(.+?)\\s+(${ROSTER_HOTEL})\\s+(\\d{1,2})\\s*(?:명|人|pax|PAX)?\\s*$`, 'u')
const RE_ROSTER_REGION_EXACT = new RegExp(`^(?:${ROSTER_REGION})$`, 'u')
const SHORT_PICKUP_ALIASES = new Set(['롯데', '신라', '오션', '어반', '공항', '히든', '메종'])
const INLINE_PICKUP_PREFIXES = [
  'Jeju International Airport 3gate, 3floor',
  'Jeju Airport 3rd Floor gate 3',
  'Jeju Airport 3gate,3floor',
  'Shilla Duty-Free Jeju Store',
  'Shilla Duty Free (Jeju Store)',
  'Shilla Duty Free(Jeju Store)',
  'LOTTE City Hotel Jeju',
  'Lotte city Hotel jeju',
  'City Hotel Jeju',
  'Hotel Jeju',
  'Ocean Suites Jeju Hotel',
  'Ocean Suites Jeju',
  'Ocean Suites Hotel',
  'Jeju International Airport',
  'Jeju Airport',
  '83 Doryeong-ro',
  '69 Noyeon-ro',
  '74 Tapdonghaean-ro',
  '신라면세점',
  '롯데시티',
  '신라',
  '롯데',
  '오션',
  '어반',
].sort((a, b) => b.length - a.length)

function parseBareRoster(
  block: string,
  productName: string | undefined,
  manualIdx: number,
): ParsedBooking | null {
  const lines = block.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0)
  if (lines.length < 2) return null
  if (/^\[\s*(오전|오후|AM|PM)?\s*\d{1,2}:\d{2}/.test(lines[0])) return null

  // party size — first "<N>명" or "여행자: N" line
  let partySize = 0
  let paxLine = -1
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/(\d{1,2})\s*명/) ?? lines[i].match(/여행자\s*[:：]\s*(\d{1,2})/)
    if (m) { partySize = Math.min(50, parseInt(m[1], 10) || 0); paxLine = i; break }
  }
  if (partySize <= 0) return null

  // name — prefer an explicit "이름: <name>" line, else the person name on the
  // pax line (after a leading region, before the hotel-abbrev + "N명" + trailer).
  let name: string | undefined
  const nameLabel = lines.find(l => /^이름\s*[:：]/.test(l))
  if (nameLabel) {
    const n = nameLabel.replace(/^이름\s*[:：]\s*/, '').trim()
    if (isPlausibleName(n)) name = n
  }
  if (!name && paxLine >= 0) {
    let cand = lines[paxLine]
      .replace(RE_ROSTER_REGION_PREFIX, '')
      .replace(RE_ROSTER_HOTEL_PAX_TRAILER, '')
      .replace(/[\s(]+$/, '')                                 // drop a dangling "(" / space
      .trim()
    // a Latin name with a trailing short Hangul location word ("Hungyu fen 공항")
    // → drop the location (mirrors parseOperatorMultiLine).
    if (/[A-Za-z]/.test(cand) && /\s+[가-힣]{1,5}$/.test(cand)) {
      cand = cand.replace(/\s+[가-힣]{1,5}$/, '').trim()
    }
    if (cand && !RE_ROSTER_REGION_OR_HOTEL_EXACT.test(cand) && isPlausibleName(cand)) {
      name = cand
    }
  }
  if (!name && paxLine > 0) {
    for (let i = paxLine - 1; i >= 0; i--) {
      const cand = normalizeLeadNameCandidate(lines[i])
      if (!cand || cand.includes('@')) continue
      if (/^\(?[+\d][\d\-\s()]{5,}$/.test(cand)) continue
      if (/\d{6,}/.test(cand)) continue
      if (RE_ROSTER_REGION_OR_HOTEL_EXACT.test(cand)) continue
      if (looksLikeStandaloneCourseHeading(cand)) continue
      if (isPlausibleName(cand)) {
        name = cand
        break
      }
    }
  }
  if (!name) return null

  // contact — email + phone (handle the "Phone number <x>" label extractPhone misses)
  const email = extractEmail(lines)
  let phone = extractPhone(lines)
  if (!phone) {
    for (const l of lines) {
      const m = l.match(/(?:Phone\s*number|Phone\s*No|연락처|전화)\s*[:：]?\s*(\+?\d[\d\s\-()]{6,})/i)
      if (m) { phone = normalizePhone(m[1]); break }
    }
  }
  if (!email && !phone) return null

  const whatsapp = extractWhatsApp(lines)
  const abbrevM = paxLine >= 0 ? lines[paxLine].match(RE_ROSTER_HOTEL_CAPTURE) : null
  const pickupPointRaw = abbrevM ? abbrevM[1] : undefined
  const resolvedProductName = extractProductName(lines, productName)
  const cruiseSignal = extractCruiseShipSignal(lines, resolvedProductName ?? productName)
  const notes = compactNoteParts([
    extractSideContacts(lines),
    ...extractCruiseNoteLines(lines, resolvedProductName ?? productName),
  ])

  const issues: string[] = []
  if (!pickupPointRaw) issues.push('missing_pickup')
  if (!email) issues.push('missing_email')
  if (!phone) issues.push('missing_phone')

  return {
    sourcePlatform: detectPlatformFromLines(lines),
    externalBookingId: extractBookingId(block) ?? `MANUAL-RT-${manualIdx}`,
    leadName: name,
    partySize,
    tourDate: extractDate(lines),
    productName: resolvedProductName,
    pickupPointRaw,
    pickupPointNormalized: undefined,
    pickupTime: extractTime(lines),
    email,
    phone,
    whatsapp,
    language: extractExplicitLanguage(lines) ?? inferLanguage(phone ?? whatsapp ?? email, name),
    notes,
    confidenceScore: 0.86,
    issues,
    cruiseShipText: cruiseSignal?.text,
  }
}

// ── per-block parser ───────────────────────────────────────────────────────

function parseBlock(
  block: string,
  productName: string | undefined,
  manualIdx: number,
): ParsedBooking | null {
  const lines = block.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0)
  if (lines.length < 2) return null

  // Skip KakaoTalk timestamp blocks ("[오전 10:29, 2026. 3. 15.] speaker: text").
  if (/^\[\s*(오전|오후|AM|PM)?\s*\d{1,2}:\d{2}/.test(lines[0])) {
    return null
  }

  const leadName = extractLeadName(lines)
  if (!leadName) return null

  const partySize = extractPartySize(lines)
  const tourDate = extractDate(lines)
  const pickupRaw = extractPickup(lines)
  const pickupTime = extractTime(lines)
  const email = extractEmail(lines)
  const phone = extractPhone(lines)
  const whatsapp = extractWhatsApp(lines)
  const externalBookingId = extractBookingId(block) ?? `MANUAL-${manualIdx}`

  const issues: string[] = []
  if (!email && !phone) issues.push('missing_contact')
  else if (!email) issues.push('missing_email')
  else if (!phone) issues.push('missing_phone')
  if (!pickupRaw) issues.push('missing_pickup')

  // Confidence floor — only emit when key fields present.
  // WhatsApp counts as contact (Korean operator paste sometimes has only
  // 왓츠앱/WhatsApp lines, no labeled phone/email).
  const score = computeConfidence({
    hasLead: true,
    hasRef: externalBookingId !== `MANUAL-${manualIdx}`,
    hasDate: !!tourDate,
    hasPickup: !!pickupRaw,
    hasContact: !!(email || phone || whatsapp),
  })
  if (score < 0.85) return null

  // Phase 26 §44.5.1 / §44.5.2 / §44.5.8 — fill language + notes from
  // deterministic signals. Explicit language label wins; else infer from phone
  // CC + name script. Pre-Phase-26, both were hardcoded undefined.
  const resolvedProductName = extractProductName(lines, productName)
  const language = extractExplicitLanguage(lines) ?? inferLanguage(phone ?? whatsapp, leadName)
  const cruiseSignal = extractCruiseShipSignal(lines, resolvedProductName ?? productName)
  const notes = compactNoteParts([
    extractSideContacts(lines),
    ...extractCruiseNoteLines(lines, resolvedProductName ?? productName),
  ])

  return {
    sourcePlatform: detectPlatformFromLines(lines),
    externalBookingId,
    leadName,
    partySize,
    tourDate,
    productName: resolvedProductName,
    pickupPointRaw: pickupRaw,
    pickupPointNormalized: undefined,
    pickupTime,
    email,
    phone,
    whatsapp,
    language,
    notes,
    confidenceScore: score,
    issues,
    cruiseShipText: cruiseSignal?.text,
  }
}

// ── slot extractors ────────────────────────────────────────────────────────

function extractLeadName(lines: string[]): string | undefined {
  for (const l of lines) {
    const parsed = parseInlineRosterHotelPax(l)
    if (parsed && isPlausibleName(parsed.name)) return parsed.name
  }

  // 1. Labeled — colon ONLY (no dash). The dash variant collided with GYG proxy
  //    emails "customer-<hash>@reply.getyourguide.com", which would otherwise
  //    capture the hash as a name.
  //    Includes 예약자명 (variant of 예약자 used in 현장결제 walk-in slips).
  for (const l of lines) {
    const m = l.match(/^(?:Lead|Lead Guest|Customer|Guest|Booker|예약자(?:명)?|이름|고객명)\s*:\s*(.+?)(?:\s+(?:연락처|결제|전화|WhatsApp).*)?$/i)
    if (m) {
      const name = m[1].trim()
      if (isPlausibleName(name)) return name
    }
  }
  // 2. Korean operator-list inline pattern. Covers:
  //    - "Name (N 명)" / "Name (인원수 x N 명)" / "Name (성인 N 명)"
  //    - "Name (N人)"  Chinese counter
  //    - "Name(N명)" / "Name(N人)"  no-space compact forms (PDF/clipboard origin)
  for (const l of lines) {
    const m = l.match(/^([^()\n]+?)\s*\(\s*(?:인원수\s*[xX×]\s*|성인\s+)?(\d+)\s*[명人]\s*\)/)
    if (m) {
      const name = normalizeLeadNameCandidate(m[1])
      if (isPlausibleName(name)) return name
    }
  }
  // 2b. English short-form: "Name(3 Adults)-EXTID" / "Name (1 Adult)-EXTID" — GYG/Viator.
  for (const l of lines) {
    const m = l.match(/^([^()\n]+?)\s*\(\s*\d+\s*Adults?\s*\)/i)
    if (m) {
      const name = normalizeLeadNameCandidate(m[1])
      if (isPlausibleName(name)) return name
    }
  }
  // 2c. Bare paren-N: "Name (2) - EXTID" / "Name(4) - EXTID" — TouristCRM /
  //     PDF-extracted bookings where the counter unit was dropped.
  for (const l of lines) {
    const m = l.match(/^([^()\n]+?)\s*\(\s*(\d+)\s*\)\s*-\s*[A-Z0-9]/i)
    if (m) {
      const name = normalizeLeadNameCandidate(m[1])
      if (isPlausibleName(name)) return name
    }
  }
  // 2d. Last 1-4 tokens before "(N 명) -" — numbered Korean operator format
  //     where the line prefix is "Nbn.  region - location ...":
  //       "5번.  남쪽 - Shilla Duty Free (Jeju Store) 淑婷 林 (1 명)  - kkday - 26KK..."
  //     Case 2 captures the WHOLE prefix as name and rejects it for length;
  //     this picks JUST the last 1-4 letter-tokens immediately before the
  //     "(N 명) -" anchor.
  for (const l of lines) {
    // 2026-05-26 — used to skip lines containing "@". That dropped dense
    // one-line bookings of the shape "Name (Person X 2) - REF Lang email phone",
    // where the email sits AFTER the (pax)-REF anchor and never interferes
    // with the regex. The regex itself is anchored on "[name](\(pax\)) - [ID]"
    // and won't match a bare email line, so the @ skip was redundant + harmful.
    const m = l.match(
      // generalized pax paren: (인원수 x 2 명) (성인 X 2) (1인) (Person X 1)
      // (2 x Adults) (3 Adults) (2) (2人) (성인 2명 명). Anchor allows the
      // following extid/platform to start with a digit ("…)-26KK…").
      /(?:^|\s)([\p{L}][\p{L}.'‘’ʼ-]*(?:\s+[\p{L}][\p{L}.'‘’ʼ-]*){0,3})\s*\(\s*(?:인원수|성인|Person)?\s*(?:[xX×]\s*)?\d+\s*(?:[xX×]\s*)?(?:명\s*명|명|人|인|Adults?|pax)?\s*\)\s*-\s*[\p{L}\d]/u,
    )
    if (m) {
      const name = normalizeLeadNameCandidate(m[1])
      if (isPlausibleName(name) && name.length <= 50) return name
    }
  }
  // 2e. Private-vehicle format: "Name (Per Vehicle (1-6 Pax) x N 대) - platform - extid".
  //     The nested "(Per Vehicle (…) x N 대)" vehicle counter parses with none of
  //     2/2b/2c/2d, and fallback #3 SKIPS this line (it carries the 6-digit extid),
  //     so the language line right below would otherwise become the name. Anchor on
  //     the "N 대) - <platform>" tail; capture the name before the first paren.
  for (const l of lines) {
    if (l.includes('@')) continue
    const m = l.match(/^([\p{L}][\p{L}.'‘’ʼ\s-]*?)\s*\([^\n]*?\d+\s*대\s*\)\s*-\s*[\p{L}]/u)
    if (m) {
      const name = normalizeLeadNameCandidate(m[1])
      if (isPlausibleName(name)) return name
    }
  }
  // 3. Else: first short line that isn't contact/booking ID and looks like a name.
  for (const l of lines) {
    if (l.includes('@')) continue
    if (/^\+?\d[\d\-\s()]{5,}$/.test(l)) continue
    if (/\d{6,}/.test(l)) continue
    if (l.length > 60) continue
    if (isPlausibleName(l)) return l
  }
  return undefined
}

function normalizeLeadNameCandidate(raw: string): string {
  let name = raw.trim().replace(/[,\s]+$/, '')
  const direct = splitKnownPickupAndRest(name)
  if (direct?.rest) name = direct.rest
  const header = name.match(RE_ROSTER_REGION_HEADER)
  if (header) {
    const split = splitKnownPickupAndRest(header[1])
    if (split?.rest) name = split.rest
  }
  return stripAddressPrefixFromName(name).trim()
}

function stripAddressPrefixFromName(raw: string): string {
  const tokens = raw.split(/\s+/).filter(Boolean)
  if (tokens.length < 3) return raw

  let lastAddressToken = -1
  for (let i = 0; i < tokens.length; i++) {
    if (looksLikeAddressToken(tokens[i])) lastAddressToken = i
  }
  if (lastAddressToken < 0 || lastAddressToken >= tokens.length - 1) return raw

  const candidate = tokens.slice(lastAddressToken + 1).join(' ').replace(/^[,/:;-]+/, '').trim()
  if (!candidate) return raw
  if (!/[A-Za-z가-힣一-鿿぀-ヿ]/.test(candidate)) return raw
  if (!isPlausibleName(candidate)) return raw
  return candidate
}

function looksLikeAddressToken(token: string): boolean {
  const cleaned = token.replace(/^[,/:;([{]+|[,/:;)\]}]+$/g, '')
  if (!cleaned) return false
  if (/(?:대한민국|제주특별자치도|제주시|서귀포시|한국|Korea|South\s*Korea|Republic\s*of\s*Korea)/i.test(cleaned)) {
    return true
  }
  if (/(?:Jeju-si|Seogwipo-si|Jeju-do|Cheju|Noyeon-ro|Doryeong-ro|Tapdonghaean-ro)/i.test(cleaned)) {
    return true
  }
  return /[가-힣]+(?:로|길)(?:\d+)?$/u.test(cleaned)
}

function splitKnownPickupAndRest(raw: string): { pickup: string; rest: string } | null {
  const source = raw
    .trim()
    .replace(/^\[\d{1,2}:\d{2}\]\s*/, '')
    .replace(/^\d+\.\s*/, '')
    .trim()
  const folded = source.toLocaleLowerCase()

  for (const prefix of INLINE_PICKUP_PREFIXES) {
    const foldedPrefix = prefix.toLocaleLowerCase()
    if (!folded.startsWith(foldedPrefix)) continue

    const pickup = source.slice(0, prefix.length).trim()
    const rest = source
      .slice(prefix.length)
      .replace(/^[\s,/:;-]+/, '')
      .replace(/^at\s+\d{1,2}:\d{2}\s*/i, '')
      .replace(/^\d{1,2}:\d{2}\s*/, '')
      .trim()

    return { pickup: pickup || prefix, rest }
  }

  return null
}

function parseInlineRosterHotelPax(line: string): { name: string; pickup: string; partySize: number } | null {
  const m = line.trim().match(RE_ROSTER_INLINE_HOTEL_PAX)
  if (!m) return null
  const name = normalizeLeadNameCandidate(m[1])
  const partySize = Math.min(50, parseInt(m[3], 10) || 0)
  if (!name || partySize <= 0) return null
  if (RE_ROSTER_REGION_EXACT.test(name)) return null
  return { name, pickup: m[2], partySize }
}

function hasInlinePaxSignal(value: string): boolean {
  return /\(\s*(?:인원수|성인|Person)?\s*(?:[xX×]\s*)?\d+\s*(?:[xX×]\s*)?(?:명\s*명|명|人|Adults?|pax)?\s*\)/i.test(value)
    || /\b\d+\s*Adults?\b/i.test(value)
    || /\bPerson\s*X\s*\d+\b/i.test(value)
}

function extractInlineCoursePickup(raw: string): string | undefined {
  const line = stripCourseMarker(raw)
  if (!line || line.includes('@')) return undefined

  const header = line.match(RE_ROSTER_REGION_HEADER)
  if (!header) return undefined

  const split = splitKnownPickupAndRest(header[1])
  if (!split?.pickup || !split.rest || !hasInlinePaxSignal(split.rest)) return undefined

  return cleanPickupCandidate(split.pickup) ?? split.pickup
}

// Shared name-plausibility guard. Canonical implementation — also imported by
// rules.ts (L2.5) and the L1 adapters (getyourguide/klook) so every layer
// rejects the same junk before emitting a booking. Keep this the single source
// of truth; do NOT re-fork weaker copies into adapters — that drift is what let
// "Traveler 2: Dietary restrictions: …" through as a leadName.
export function isPlausibleName(s: string): boolean {
  if (s.length < 2 || s.length > 60) return false
  if (/^\d/.test(s)) return false
  if (s.includes('@')) return false
  if (/^(?:tour|course|상품|코스|investment|invoice|customer|guest|lead|traveler|traveller|participant|passenger|pax)\b/i.test(s)) return false
  // GYG/Viator metadata lines that are never names — "Traveler 2: Dietary
  // restrictions: Shellfish Allergy", "Special requirements: ...", "Allergies:".
  // A genuine name never contains these phrases anywhere in the string.
  if (/\b(?:dietary|restriction|allerg|special requirement|requirements?:|wheelchair|mobility|booking ref)/i.test(s)) return false
  // A "Label: value" line where the label is a known metadata key is not a name.
  if (/^[A-Za-z][A-Za-z ]{2,30}:\s/.test(s) && /:/.test(s)) {
    // Only reject when the prefix is a metadata-ish word (has a colon early and
    // the head is a common field label). Real names rarely contain a colon.
    if (/^(?:traveler|traveller|guest|note|notes|remark|dietary|special|pickup|drop|flight|cabin|deck|room|seat)/i.test(s)) return false
  }
  // Reject KakaoTalk speaker honorifics.
  if (/(형님|사장님|대표|이사)$/.test(s)) return false
  // Korean note-field labels are never names (the Latin "Label:" guard above
  // misses them because they start with Hangul). Catches fragments like
  // "비고: 도착 정보:" that re-segmentation can leave as a block head.
  if (/^(?:비고|메모|특이사항|도착\s*정보|출발\s*정보|특별\s*요구사항|하차\s*위치|하선\s*시간|크루즈선|선호\s*언어|항공편)\s*[:：]/.test(s)) return false
  // 2026-05-26 — region-prefix pickup header line ("동쪽 - Ocean Suites Jeju",
  // "남쪽 - Lotte Duty Free Jeju Store,") is never a name. The fallback "first
  // plausible line" loops were grabbing these whenever the real name line was
  // skipped by other filters (e.g. dense one-line bookings with embedded @).
  if (/^(?:동쪽|남쪽|서쪽|북쪽|동남쪽|서남쪽|서북쪽|동북쪽|제주\s*동쪽|제주\s*남쪽|제주항|강정항|부산항|인천항)\s*[-,]/u.test(s)) return false
  // Korean tour-category headers that share a block with the real booking
  // (the `//` empty-slot form interleaves a standalone "일반투어" header line).
  // Reject ONLY exact standalone category labels — NOT a broad `투어$` suffix,
  // which would re-route long v3/v4 product lines into backtracking-prone L2.5
  // rules and hang the parser (ReDoS). This keeps routing essentially unchanged.
  if (/^(?:일반투어|버스투어|프라이빗|일반|크루즈투어|제주크루즈|크루즈)$/.test(s)) return false
  // Standalone language labels are the language field, never a name. A name line
  // that carries the 6-digit booking id is skipped by fallback #3, which would
  // otherwise let the bare "중국어" / "English" language line below it become the
  // leadName (seen on private-vehicle "Per Vehicle … 대" bookings).
  if (/^(?:중국어|영어|일본어|한국어|Chinese|English|Japanese|Korean|Mandarin|Cantonese|Spanish|French)$/i.test(s)) return false
  // Operator instruction / notice lines interleaved into a booking block are
  // never names. Korean pastes carry lines like "다음 내용을 꼭 참고하세요 !!"
  // (please note the following!!), "아래 내용 확인 부탁드립니다", "필독!!". The
  // markers below never occur in a real personal name:
  //   (a) a trailing exclamation mark,
  //   (b) a Korean polite verb / sentence ending (verb conjugations, not names),
  //   (c) a notice keyword.
  if (/[!！]\s*$/.test(s)) return false
  if (/(?:하세요|해주세요|주세요|하십시오|바랍니다|드립니다|부탁|니다\s*$)/.test(s)) return false
  if (/(?:참고|필독|공지|주의사항|유의사항)/.test(s)) return false
  // Accept Korean Hangul, Latin, CJK Unified (Chinese), and Japanese kana.
  return /[가-힣A-Za-z一-鿿぀-ヿ]/.test(s)
}

function extractPartySize(lines: string[]): number {
  for (const l of lines) {
    const parsed = parseInlineRosterHotelPax(l)
    if (parsed) return parsed.partySize
  }

  for (const l of lines) {
    // Skip vehicle-count lines ("N대").
    if (/\d+\s*대\b/.test(l) && !/(?:인원|성인|pax|people|participants|adults?)/i.test(l)) {
      continue
    }

    // 1. Labeled: "Pax: 3", "Adults: 4", "성인: 2", "인원수: 3"
    let m = l.match(/(?:인원수?|성인|Pax|People|Participants|Travelers|Adults?)\s*[:-]?\s*(\d+)/i)
    if (m) {
      const n = parseInt(m[1], 10)
      if (n > 0) return Math.min(50, n)
    }

    // 2. Inline Korean / Chinese counter: "(인원수 x 3 명)", "(인원수 X3명)",
    //    "(성인 4 명)", "(3 명)", "(2人)", "(1명)" no-space.
    m = l.match(/\(\s*(?:인원수|성인|Person)?\s*(?:[xX×]\s*)?(\d+)\s*(?:[xX×]\s*)?(?:명\s*명|명|人|인|Adults?|pax)?\s*\)/)
    if (m) {
      const n = parseInt(m[1], 10)
      if (n > 0) return Math.min(50, n)
    }

    // 3. Inline English: "Name(3 Adults)" / "Name (1 Adult)" — GYG/Viator short forms.
    m = l.match(/\(\s*(\d+)\s*Adults?\s*\)/i)
    if (m) {
      const n = parseInt(m[1], 10)
      if (n > 0) return Math.min(50, n)
    }

    // 4. Short-dash compact: "(인원수 X2명)" (no spaces between X and digit).
    m = l.match(/\(\s*인원수\s*[xX×]\s*(\d+)\s*명?\s*\)/i)
    if (m) {
      const n = parseInt(m[1], 10)
      if (n > 0) return Math.min(50, n)
    }

    // 5. Bare paren-N (TouristCRM / PDF-mangled): "Name (2) - EXTID" — counter
    //    unit dropped. Only accept when followed by a dash+ID-shaped token
    //    to avoid catching incidental "(2)" inside notes/addresses.
    m = l.match(/\(\s*(\d+)\s*\)\s*-\s*[A-Z0-9]/i)
    if (m) {
      const n = parseInt(m[1], 10)
      if (n > 0) return Math.min(50, n)
    }
  }

  // Fallback: a bare "N명" line.
  for (const l of lines) {
    const m = l.match(/^(\d{1,2})\s*명$/)
    if (m) {
      const n = parseInt(m[1], 10)
      if (n > 0) return Math.min(50, n)
    }
  }
  return 1
}

function detectPlatformFromLines(lines: string[]): OTASource {
  const joined = lines.join('\n')
  if (/겟유가이드|getyourguide|\bGYG/i.test(joined)) return 'gyg'
  if (/클룩|klook/i.test(joined)) return 'klook'
  if (/비아토르|viator|\bBR-/i.test(joined)) return 'viator'
  if (/kkday|케이케이데이|\b\d{2}KK\d{6,}/.test(joined)) return 'kkday'
  if (/트립닷컴|tripcom|trip\.com/i.test(joined)) return 'tripcom'
  // TouristCRM and Airbnb are non-OTA channels; closest classification is
  // 'manual' (operator-managed) — preserves the platform string in notes via
  // the rule's postprocess if a matching rule fires, otherwise just 'manual'.
  return 'manual'
}

function extractDate(lines: string[]): string | undefined {
  for (const l of lines) {
    let m = l.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/)
    if (m) return `${m[1]}-${pad2(m[2])}-${pad2(m[3])}`
    m = l.match(/(\d{1,2})[\-/](\d{1,2})[\-/](\d{4})/)
    if (m) return `${m[3]}-${pad2(m[1])}-${pad2(m[2])}`
  }
  return undefined
}

function extractTime(lines: string[]): string | undefined {
  for (const l of lines) {
    if (l.includes('@')) continue
    // Look for "픽업시간 09:00" / "Time: 9:00 AM" / standalone "08:55"
    const m = l.match(/(?:^|\s)(\d{1,2}):(\d{2})(?:\s*(AM|PM|오전|오후))?/i)
    if (!m) continue
    let h = parseInt(m[1], 10)
    const min = parseInt(m[2], 10)
    if (h < 0 || h > 23 || min < 0 || min > 59) continue
    const ampm = m[3]
    if (ampm) {
      const upper = ampm.toUpperCase()
      if ((upper === 'PM' || ampm === '오후') && h < 12) h += 12
      if ((upper === 'AM' || ampm === '오전') && h === 12) h = 0
    }
    return `${pad2(h.toString())}:${pad2(min.toString())}`
  }
  return undefined
}

function extractPickup(lines: string[]): string | undefined {
  for (const l of lines) {
    const parsed = parseInlineRosterHotelPax(l)
    if (parsed && isValidPickupCandidate(parsed.pickup)) return parsed.pickup
  }

  // Labeled — colon-only to avoid label/value collisions.
  for (const l of lines) {
    const m = l.match(/^(?:Pickup|Meeting Point|Meet|Hotel|픽업\s*장소?|픽업|만나는?\s*곳)\s*:\s*(.+)$/i)
    if (m) {
      const loc = m[1].trim()
      if (isValidPickupCandidate(loc)) return loc
    }
  }
  // Sprint 27.G-B — INLINE label inside a 비고 run: "… 출발 장소: 서귀포 강정
  // 크루즈 터미널 항공편 도착 시간: …". Capture up to the next known field label
  // (not anchored at line start, unlike the colon-only loop above).
  for (const l of lines) {
    const m = l.match(/(?:출발\s*장소|픽업\s*위치|만남의?\s*장소|탑승\s*장소)\s*[:：]\s*(.+?)(?:\s*(?:항공편|도착\s*정보|하선|하차|탑승\s*시간|선호\s*언어|연락처|이메일|전화)|$)/)
    if (m && m[1].trim().length > 2) return m[1].trim()
  }
  // Compressed manual rows sometimes put everything on one line:
  // "<region> - <known pickup> <name>(<pax>) - <ref>". Recover the pickup
  // before the generic course-header parser rejects the tail for carrying pax.
  for (const l of lines) {
    const pickup = extractInlineCoursePickup(l)
    if (pickup) return pickup
  }
  // "… 입장료 (포함|미포함) - <pickup>" product-prefixed header line.
  for (const l of lines) {
    const m = l.match(/입장료\s*(?:포함|미포함)\s*-\s*(.+)$/)
    if (m) {
      const loc = m[1].trim().replace(/[,\s]+$/, '')
      if (loc.length > 2 && !/\(\s*\d|\d+\s*[명人]|Adults?|클룩|비아토르|겟유가이드|kkday/i.test(loc)) return loc
    }
  }
  // Course-prefixed header: "<course> - <pickup>". This keeps course grouping
  // and pickup extraction in sync for regions, Camellia, cherry blossom,
  // cruise/small-group, and private tours.
  for (const l of lines) {
    const parsed = parseCourseHeader(l)
    if (parsed?.pickup) return parsed.pickup
  }
  // Korean operator header: "Nth. region - LOCATION (optional time)".
  // Accepts "미정"/"TBD"/"TBA" as semantically meaningful "to-be-determined"
  // pickup markers even though they're only 2-3 chars.
  for (const l of lines) {
    const m = l.match(/^\d+\s*[번.]?\.?\s*[^\-\n]*-\s*(.+?)(?:\s+at\s+\d{1,2}:\d{2}|\s+\d{1,2}:\d{2}\b|\s*$)/)
    if (m) {
      const loc = m[1].trim()
      // A real pickup always carries a letter (Latin / Hangul / CJK / kana).
      // Reject all-digit captures: a bare "<CC>-<number>" phone line like
      // "91-9591245585" otherwise reads as "<item-no> - <location>" and steals
      // the pickup slot from the standalone "<region> - <hotel>" header that
      // the region-anchored loop below would resolve correctly.
      const hasLetter = /[A-Za-z가-힣一-鿿぀-ヿ]/.test(loc)
      const acceptable = (loc.length > 2 && hasLetter) || /^(?:미정|TBD|TBA|tbd|tba)$/.test(loc)
      if (acceptable && !/^(?:Lead|Customer|Guest|email|phone)/i.test(loc)) {
        return loc
      }
    }
  }
  // Sprint 27.G-B — multi-line manual-notes header: "<region> - <pickup>" on
  // its own line (no leading digit), e.g. "서남쪽 - Ocean Suites Jeju Hotel",
  // "남쪽 - 83 Doryeong-ro, Cheju,". Region prefix is the gatekeeper. Reject
  // when the tail still carries a name/pax/platform marker (that's a one-line
  // "region - NAME (N명) - 클룩" booking the numbered pattern above handles),
  // so this only fires on a clean standalone pickup line. " / " slash rosters
  // (v3/v5) never match — they have no " - " right after the region.
  for (const l of lines) {
    const m = l.match(/^(?:동쪽|남쪽|서남쪽|서쪽|북쪽|동남쪽|서북쪽|동북쪽|제주항|강정항|부산항|인천항)(?:\s*-\s*(?:일반|프라이빗))?\s*-\s*(.+)$/)
    if (m) {
      // Strip a trailing "비고:"/note label the greedy capture may swallow.
      const loc = m[1].trim().replace(/\s*비고\s*[:：].*$/, '').replace(/[,\s]+$/, '')
      // NB: "미정"/TBD is intentionally NOT accepted here (length ≤ 2 fails) —
      // a to-be-determined pickup must not newly clear the confidence floor and
      // shift the v1–v5 deterministic baselines. The numbered header pattern
      // above keeps its existing 미정 behavior.
      if (loc.length > 2 && !/\(\s*\d|\d+\s*[명人]|Adults?|클룩|비아토르|겟유가이드|kkday/i.test(loc)) {
        return loc
      }
    }
  }
  return undefined
}

function extractEmail(lines: string[]): string | undefined {
  for (let i = 0; i < lines.length; i++) {
    const parts: string[] = []
    if (i > 0 && /[\w.+-]+-$/.test(lines[i - 1])) parts.push(lines[i - 1])
    parts.push(lines[i])
    if (i + 1 < lines.length && /^[\w-]+(?:\.[\w-]+)+$/.test(lines[i + 1])) parts.push(lines[i + 1])
    if (parts.length === 1) continue

    const joined = parts.join('').replace(/\s+/g, '')
    const m = joined.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)
    if (m) return m[0].toLowerCase()
  }

  for (const l of lines) {
    const m = l.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)
    if (m) return m[0].toLowerCase()
  }
  const compact = lines.join('').replace(/\s+/g, '')
  const m = compact.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)
  if (m) return m[0].toLowerCase()
  return undefined
}

function extractPhone(lines: string[]): string | undefined {
  for (const l of lines) {
    for (const segment of splitContactSegments(l)) {
      const phonePart = segment.replace(/[‪-‮‎‏]/g, '').split(/(?:WhatsApp|왓츠앱)/i)[0]
      if (!phonePart.trim()) continue
      // 전화번호 (the common Korean operator-roster spelling) must be accepted
      // alongside the bare 전화 label. The "번호" suffix isn't a separator so
      // `전화` alone fails to anchor before the digits.
      const m = phonePart.match(/(?:Phone\s*number|Phone\s*No|Phone|Mobile|Tel|전화(?:번호)?|연락처)\s*[:：\-]?\s*(\(?\+?[\d\s\-()‐‑‒–]{7,}\d)/i)
      if (m) return normalizePhone(m[1])
      const inline = extractInlinePhone(phonePart)
      if (inline) return inline
      // Bare phone (no label) on its own line — allow a leading "(+CC-...)"
      // form like "(+1-939) 9397172466".
      if (/^\(?[+\d][\d\-\s()‐‑‒–]{6,}\d$/.test(phonePart.trim())) return normalizePhone(phonePart)
    }
  }
  return undefined
}

function splitContactSegments(line: string): string[] {
  return line.split(/\s\/\s/).map(s => s.trim()).filter(Boolean)
}

function extractInlinePhone(line: string): string | undefined {
  const re = /(?<![A-Z0-9-])([+＋]?\d[\d\s()\-‐‑‒–]{6,}\d)/gi
  for (const m of line.matchAll(re)) {
    const raw = m[1]
    if (raw.includes(',')) continue
    const normalized = normalizePhone(raw)
    const digits = normalized.replace(/\D/g, '')
    if (digits.length < 7) continue
    return normalized
  }
  return undefined
}

function extractWhatsApp(lines: string[]): string | undefined {
  for (const raw of lines) {
    // Korean operator pastes wrap WhatsApp numbers in full-width parens
    // "（852）…" and pad them with bidi marks (‪ ‬ U+202A/U+202C) + non-breaking
    // hyphens (‑ U+2011). Strip the bidi marks and accept those glyphs so the
    // number is captured; normalizePhone then reduces it to digits.
    const l = raw.replace(/[‪-‮‎‏]/g, '')
    const m = l.match(/\(?\s*(?:WhatsApp|왓츠앱)\s*\)?\s*[:/]?\s*([+＋]?[\d\-\s()（）‐‑‒–]{7,})/i)
    if (m) return normalizePhone(m[1])
  }
  return undefined
}

export function extractBookingId(block: string): string | undefined {
  // Try platform-specific patterns first (preserve full canonical form), then
  // generic fallback. The earlier single-pattern version missed:
  //   - 25KK229300245 (KKday digit-year prefix — `\b` doesn't fire between 5/K)
  //   - GYG99697LZBH (mixed letters+digits after GYG prefix)
  //   - BR-1331852399 was matched but had dashes stripped (lossy)
  // OTA-shape patterns — accepted as-is (the shape itself proves it's a ref).
  const strongPatterns: RegExp[] = [
    /\b(BR-\d{8,12})\b/,                              // Viator
    /\b(GYG[A-Z0-9]{8,14})\b/,                        // GetYourGuide
    /(?<![A-Za-z0-9])(\d{2}KK\d{8,14})\b/,            // KKday (year prefix)
    /\b([A-Z]{3}\d{6})\b/,                            // Klook
    /\b([A-Z]{2,5}[\-_]?\d{6,12})\b/,                 // Generic fallback
  ]
  // Loose fallbacks — a LABELED token (예약#…, 바우처:…, booking no …) or a
  // bracketed token ([AT0603R3N026]). These match arbitrary words, so accept the
  // capture ONLY when it contains a digit: real refs do, plain words like
  // "note"/"Note"/"confirmed"/"Info" do NOT — preventing phantom refs (which also
  // cause false dedup collisions). ReDoS-safe: literal label alternation + bounded
  // value class.
  const loosePatterns: RegExp[] = [
    /(?:예약\s*[#＃]|예약\s*번호\s*[:：#]?|바우처\s*[:：#]?|voucher\s*[:：#]?|booking\s*(?:no|id|ref)?\s*[:：#]?|ref\s*[:：#]|확인\s*번호\s*[:：#]?)\s*([A-Za-z0-9][A-Za-z0-9\-]{3,30})/i,
    /[\[【]\s*([A-Za-z]{2}[A-Za-z0-9\-]{2,30})\s*[\]】]/,
  ]
  for (const re of strongPatterns) {
    const m = block.match(re)
    if (m) return m[1]
  }
  for (const re of loosePatterns) {
    const m = block.match(re)
    if (m && /\d/.test(m[1]!)) return m[1]
  }
  return undefined
}

function normalizePhone(s: string): string {
  // Canonicalize to "+<digits>" / "<digits>" — strips ASCII separators AND the
  // full-width parens "（）", unicode hyphens "‐‑‒–", and bidi marks Korean
  // operator pastes embed. Equivalent to the old "[\s\-()]" strip for ASCII
  // phone strings (v1–v5 unchanged), but also cleans the unicode variants.
  const t = s.trim()
  const plus = /^[+＋]/.test(t) ? '+' : ''
  return plus + t.replace(/[^\d]/g, '')
}

// Phase 26 §44.5.8 — explicit language label in the source ALWAYS wins
// (system.txt §FIELD RULES priority 1). The numbered-multiline format carries
// a standalone "English" / "중국어" line that must override phone-CC inference
// (e.g. a guest with a Korean +82 SIM who selected English).
export function extractExplicitLanguage(lines: string[]): string | undefined {
  for (const l of lines) {
    if (/(?:^|\s)(?:English|영어)(?:\s|$|비고|:)/i.test(l)) return 'en'
    if (/(?:Chinese|중국어|中文|普通话|Mandarin|Cantonese|廣東話)/i.test(l)) return 'zh'
    if (/(?:Japanese|일본어|日本語)/i.test(l)) return 'ja'
    if (/(?:Korean|한국어)/i.test(l)) return 'ko'
    if (/(?:French|프랑스어|Français)/i.test(l)) return 'fr'
    if (/(?:Spanish|스페인어|Español)/i.test(l)) return 'es'
  }
  return undefined
}

// Phase 26 §44.5.9 — normalize a raw language value (slot capture or column)
// to an ISO 639-1 code. Accepts existing 2-letter codes as-is, maps known
// labels (English/영어/Chinese/중국어/中文…) via extractExplicitLanguage, and
// returns undefined for empty/unknown (caller falls back to inference).
export function normalizeLang(raw?: string): string | undefined {
  if (!raw) return undefined
  const v = raw.trim()
  if (!v) return undefined
  const lower = v.toLowerCase()
  if (/^(?:en|ko|zh|ja|fr|es|de|it|pt|ru|th|vi|id|ms|nl|pl|tr|ar)$/.test(lower)) return lower
  return extractExplicitLanguage([v])
}

// Phase 26 §44.5.1 — language inference, mirror of prompts/system.txt
// §FIELD RULES priority order:
//   1. Phone country code (most reliable; survives mixed-script names)
//   2. Name script (fallback)
// Returns undefined when no signal — caller decides whether to default to en.
// NOTE: callers should try extractExplicitLanguage() FIRST (priority 1) and
// fall back to this only when the source has no explicit language label.
export function inferLanguage(phone?: string, leadName?: string): string | undefined {
  if (phone) {
    const e164 = phone.replace(/[^+\d]/g, '')
    if (/^\+?82/.test(e164))                   return 'ko'
    if (/^\+?(886|852|86)/.test(e164))         return 'zh'   // TW / HK / mainland
    if (/^\+?81/.test(e164))                   return 'ja'
    if (/^\+?(1|44)/.test(e164))               return 'en'
    if (/^\+?33/.test(e164))                   return 'fr'
    if (/^\+?34/.test(e164))                   return 'es'
  }
  if (leadName) {
    if (/[가-힣]/.test(leadName))              return 'ko'
    if (/[぀-ヿ]/.test(leadName))              return 'ja'   // Hiragana / Katakana
    if (/[一-鿿]/.test(leadName))              return 'zh'   // Han only (Hangul caught above)
    if (/^[A-Za-z][A-Za-z\s.''ʼ-]+$/.test(leadName)) return 'en'
  }
  return undefined
}

// Phase 26 §44.5.2 — preserve side-channel contact IDs + 비고 lines so
// reachability (§41.2) can populate line_id / kakao_id / zalo_id columns
// and the Step 5 review card can render them. Returns undefined when no
// markers are present (don't pollute notes with empty string).
export function extractSideContacts(lines: string[]): string | undefined {
  const parts: string[] = []
  for (const l of lines) {
    let m = l.match(/(?:WeChat|위챗)(?:\s+ID)?\s*[:/]?\s*([^\s/|]+)/i)
    if (m) parts.push(`wechat=${m[1]}`)
    m = l.match(/(?:LINE|라인)(?:\s+ID)?\s*[:/]?\s*([^\s/|]+)/i)
    if (m) parts.push(`line=${m[1]}`)
    m = l.match(/(?:Kakao|카카오톡?)(?:\s+ID)?\s*[:/]?\s*([^\s/|]+)/i)
    if (m) parts.push(`kakao=${m[1]}`)
    m = l.match(/(?:Zalo|잘로)(?:\s+ID)?\s*[:/]?\s*([^\s/|]+)/i)
    if (m) parts.push(`zalo=${m[1]}`)
    // 비고/메모/특이사항/note/remark — preserve the whole line so operator
    // free-text (allergies, wheelchair, group reunification requests) survives.
    if (/^(?:비고|메모|특이사항|note|remark)\s*[:\-]/i.test(l)) {
      const stripped = l.replace(/^(?:비고|메모|특이사항|note|remark)\s*[:\-]\s*/i, '').trim()
      if (stripped) parts.push(`remark=${stripped}`)
    }
    // 특별 요구사항 / special requirements — capture the value (may be inline in
    // a longer 비고 line), stopping before the next field marker.
    m = l.match(/(?:특별\s*요구사항|special\s*requirements?)\s*[:：]\s*(.+?)(?:\s*(?:도착\s*정보|항공편|연락처|이메일|전화)\b|$)/i)
    if (m && m[1].trim()) parts.push(`special=${m[1].trim()}`)
  }
  return parts.length > 0 ? parts.join(' | ') : undefined
}

interface CruiseShipSignal {
  text: string
  line?: string
}

function extractCruiseShipSignal(lines: string[], productName?: string): CruiseShipSignal | undefined {
  const hasCruiseContext = hasCruiseRosterContext(lines, productName)

  for (const line of lines) {
    let m = line.match(/(?:크루즈선|선박\s*명?|Cruise\s*ship|Ship)\s*[:：]\s*(.+)$/i)
    if (m) {
      const text = cleanCruiseShipText(m[1])
      if (text) return { text, line }
    }

    // Cruise OTAs sometimes put the ship in a "flight number" field.
    if (hasCruiseContext) {
      m = line.match(/항공편명(?:\s*\([^)]*\))?\s*[:：]?\s*(.+)$/i)
      if (m) {
        const text = cleanCruiseShipText(m[1])
        if (text) return { text, line }
      }
    }
  }

  if (!hasCruiseContext) return undefined

  const joined = lines.join(' ')
  const known = knownCruiseShipFromText(joined)
  return known ? { text: known } : undefined
}

function extractCruiseNoteLines(lines: string[], productName?: string): string[] {
  if (!hasCruiseRosterContext(lines, productName)) return []
  return lines.filter(line =>
    /(?:크루즈선|하선\s*시간|하차\s*위치|도착\s*정보|출발\s*장소|항공편명|cruise\s*ship|cruise\s*terminal|port\s*of|gangjeong|seogwipo)/i.test(line),
  )
}

function hasCruiseRosterContext(lines: string[], productName?: string): boolean {
  const context = `${productName ?? ''}\n${lines.join('\n')}`
  return /크루즈|cruise|스몰\s*그룹|스몰그룹|하선\s*시간|하차\s*위치|cruise\s*terminal/i.test(context)
}

function compactNoteParts(parts: Array<string | undefined>): string | undefined {
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of parts) {
    const v = part?.trim()
    if (!v || seen.has(v)) continue
    seen.add(v)
    out.push(v)
  }
  return out.length > 0 ? out.join(' | ') : undefined
}

function cleanCruiseShipText(raw: string): string | undefined {
  const v = raw
    .replace(/\s+(?:하선\s*시간|하차\s*위치|출발\s*정보|도착\s*정보|탑승\s*시간|항공편\s*도착\s*시간|선호\s*언어|연락처|이메일|전화|Phone|WhatsApp|Arrival|Departure|arrive|depart)\b.*$/i, '')
    .replace(/[\/,;|:\s]+$/, '')
    .trim()

  if (v.length < 3) return undefined
  if (!/[A-Za-z가-힣一-鿿぀-ヿ]/.test(v)) return undefined
  if (/^(?:미정|unknown|none|null|n\/?a|-+)$/i.test(v)) return undefined

  return knownCruiseShipFromText(v) ?? v
}

function knownCruiseShipFromText(raw: string): string | undefined {
  const s = raw.replace(/\s+/g, ' ').trim()
  const known: Array<[RegExp, string]> = [
    [/\bCelebrity\s+(?:Millennium|Millenium|Milenium|Milennium|Millennium)\b/i, 'Celebrity Millennium'],
    [/\bMSC\s*Bell?i?s?sima\b/i, 'MSC Bellissima'],
    [/\bSpectrum\s+(?:of\s+the\s+Seas|f\s+the\s+Seaso?s?)\b/i, 'Spectrum of the Seas'],
    [/\bNorwegian\s+Spirit\b/i, 'Norwegian Spirit'],
    [/\bNCL\s+Spirit\b/i, 'Norwegian Spirit'],
    [/\bDiamond\s+Princess\b/i, 'Diamond Princess'],
    [/\bMein\s+Schiff\s+\d+\b/i, 'Mein Schiff 6'],
    [/\bCosta\s*Serena\b/i, 'Costa Serena'],
    [/\bOvation\s+of\s+the\s+Seas\b/i, 'Ovation of the Seas'],
    [/\bAnthem\s+of\s+the\s+Seas\b/i, 'Anthem of the Seas'],
    [/\bQuantum\s+of\s+the\s+Seas\b/i, 'Quantum of the Seas'],
    [/\bVoyager\s+of\s+the\s+Seas\b/i, 'Voyager of the Seas'],
  ]
  for (const [pattern, canonical] of known) {
    if (pattern.test(s)) return canonical
  }
  return undefined
}

function pad2(s: string): string {
  return s.length < 2 ? `0${s}` : s
}

const COURSE_REGION_RE = /^(?:제주\s*)?(남쪽|동쪽|서남쪽|서쪽|북쪽|동남쪽|서북쪽|동북쪽)$/

interface CourseHeader {
  productName: string
  pickup?: string
}

function extractProductName(lines: string[], fallback: string | undefined): string | undefined {
  for (const line of lines) {
    const parsed = parseCourseHeader(line)
    if (parsed?.productName) return parsed.productName
  }
  return fallback
}

function parseCourseHeader(raw: string): CourseHeader | null {
  const line = stripCourseMarker(raw)
  if (!line || line.includes('@')) return null

  const spacedParts = line
    .split(/\s+-\s+/)
    .map(part => part.trim())
    .filter(Boolean)
  if (spacedParts.length >= 2 && looksLikeCourseSegment(spacedParts[0])) {
    let productSegments = [spacedParts[0]]
    let pickupIndex = 1

    if (/카멜리아/i.test(spacedParts[0]) && /^입장료\s*(?:포함|미포함)/.test(spacedParts[1])) {
      productSegments = [spacedParts[0], spacedParts[1]]
      pickupIndex = 2
    }

    const productName = normalizeProductName(productSegments.join(' - '))
    const pickup = cleanPickupCandidate(spacedParts.slice(pickupIndex).join(' - '))
    return pickup ? { productName, pickup } : { productName }
  }

  // Some operator lines omit the space before the dash: "서남쪽- Ocean Suites".
  const regionNoSpace = line.match(/^(남쪽|동쪽|서남쪽|서쪽|북쪽|동남쪽|서북쪽|동북쪽)\s*-\s*(.+)$/)
  if (regionNoSpace) {
    const productName = normalizeProductName(regionNoSpace[1])
    const pickup = cleanPickupCandidate(regionNoSpace[2])
    return pickup ? { productName, pickup } : { productName }
  }

  if (looksLikeStandaloneCourseHeading(line)) {
    return { productName: normalizeProductName(line) }
  }

  const inlineRegion = line.match(/^(?:제주도?\s*)?(남쪽|동쪽|서남쪽)\b/)
  if (inlineRegion && !/\s+-\s+/.test(line)) {
    return { productName: normalizeProductName(inlineRegion[1]) }
  }

  return null
}

function stripCourseMarker(raw: string): string {
  return raw
    .trim()
    .replace(/^\d+\s*(?:번\.?|번|[.)])?\s*/, '')
    .replace(/^[*•]\s*/, '')
    .replace(/[,:：\s]+$/, '')
    .trim()
}

function looksLikeCourseSegment(value: string): boolean {
  const v = stripCourseMarker(value)
  return (
    COURSE_REGION_RE.test(v)
    || /카멜리아|벚꽃|크루즈|cruise|스몰\s*그룹|스몰그룹|프라이빗/i.test(v)
  )
}

function looksLikeStandaloneCourseHeading(value: string): boolean {
  const v = stripCourseMarker(value)
  if (v.length > 60) return false
  if (/\d{6,}/.test(v)) return false
  return looksLikeCourseSegment(v) || /^스몰\s*그룹$/i.test(v) || /^스몰그룹$/i.test(v)
}

function normalizeProductName(raw: string): string {
  const v = raw.replace(/\s+/g, ' ').trim()
  const region = v.match(COURSE_REGION_RE)
  if (region) return region[1]

  const camellia = v.match(/카멜리아\s*겨울\s*(동쪽|서남쪽|남쪽).*?입장료\s*(미포함|포함)/)
  if (camellia) return `카멜리아 겨울 ${camellia[1]} - 입장료 ${camellia[2]}`

  if (/벚꽃/.test(v)) {
    const cherryRegion = v.match(/(동쪽|서남쪽|남쪽)/)
    return cherryRegion ? `제주 벚꽃 ${cherryRegion[1]}` : v
  }

  if (/스몰\s*그룹|스몰그룹/i.test(v) && /크루즈|cruise|스몰/i.test(v)) {
    return '제주 크루즈 스몰 그룹'
  }

  if (/제주\s*크루즈|크루즈|cruise/i.test(v)) {
    if (/프라이빗/.test(v)) return '제주 크루즈 프라이빗'
    if (/버스|일반/.test(v)) return '제주 크루즈 버스투어'
    return v.includes('제주') ? v : `제주 ${v}`
  }

  return v
}

function cleanPickupCandidate(raw: string): string | undefined {
  const loc = raw
    .trim()
    .replace(/^\[\d{1,2}:\d{2}\]\s*/, '')
    .replace(/\s+at\s+\d{1,2}:\d{2}.*$/i, '')
    .replace(/\s+\d{1,2}:\d{2}(?:\s+\d{1,2}:\d{2})?.*$/, '')
    .replace(/\s*비고(?:\s*[:：].*)?$/, '')
    .replace(/[,\s]+$/, '')
    .trim()

  if (!isValidPickupCandidate(loc)) return undefined
  return loc
}

function isValidPickupCandidate(loc: string): boolean {
  if (SHORT_PICKUP_ALIASES.has(loc)) return true
  if (loc.length <= 2) return false
  if (!/[A-Za-z가-힣一-鿿぀-ヿ]/.test(loc)) return false
  if (/\(\s*\d|\d+\s*[명人]|Adults?|Person\s*X|클룩|비아토르|겟유가이드|kkday/i.test(loc)) return false
  return !/^(?:Lead|Customer|Guest|email|phone)$/i.test(loc)
}

function looksLikeProductHeading(block: string): boolean {
  if (block.length > 80) return false
  if (block.includes('@')) return false
  if (/\d{4}-\d{2}-\d{2}/.test(block)) return false
  if (/\d{6,}/.test(block)) return false
  return /(코스|투어|tour|course|experience|상품)/i.test(block) || looksLikeStandaloneCourseHeading(block)
}

function stripProductPrefix(raw: string): string {
  return normalizeProductName(raw
    .replace(/^\[[^\]]+\]\s*/, '')
    .replace(/^상품명?\s*[:-]\s*/, '')
    .replace(/^코스명?\s*[:-]\s*/, '')
    .trim())
}

function computeConfidence(f: {
  hasLead: boolean
  hasRef: boolean
  hasDate: boolean
  hasPickup: boolean
  hasContact: boolean
}): number {
  let score = 0.5
  if (f.hasLead) score += 0.15
  if (f.hasRef) score += 0.1
  if (f.hasDate) score += 0.1
  if (f.hasPickup) score += 0.1
  if (f.hasContact) score += 0.1
  return Math.min(1, score)
}
