// Phase 0-bis — Client-side SSE reader for the import funnel
// Used by ImportWizard.tsx to consume /api/import streaming responses.

export type FunnelEventName =
  | 'file_ingest_done'
  | 'l0_start' | 'l0_done'
  | 'l1_start' | 'l1_done'
  | 'l2_start' | 'l2_done'
  | 'l3_start' | 'l3_done'
  | 'l4_start' | 'l4_done'
  | 'cruise_date_infer_start' | 'cruise_date_infer_done'
  | 'tour_date_default_done'
  | 'persist_start' | 'persist_done'
  | 'complete' | 'error'

export interface SseEvent {
  event: FunnelEventName
  data: Record<string, unknown>
}

export interface SseRequest {
  platform: string
  rawData?: string
  file?: File | null
  forceAccuracy?: boolean
  signal?: AbortSignal
  onEvent: (e: SseEvent) => void
}

export interface SheetsSseRequest {
  sheetUrl: string
  column?: string
  startRow?: number
  endRow?: number
  platform?: string
  forceAccuracy?: boolean
  signal?: AbortSignal
  onEvent: (e: SseEvent) => void
}

/**
 * POST to /api/import as SSE. Calls onEvent for every parsed event line.
 * Resolves once the stream closes (or rejects on network/HTTP error).
 */
export async function streamImport(req: SseRequest): Promise<void> {
  let body: BodyInit
  const headers: Record<string, string> = { accept: 'text/event-stream' }

  if (req.file) {
    const fd = new FormData()
    fd.append('file', req.file)
    fd.append('platform', req.platform)
    if (req.forceAccuracy) fd.append('forceAccuracy', 'true')
    body = fd
  } else {
    headers['content-type'] = 'application/json'
    body = JSON.stringify({
      platform: req.platform,
      rawData: req.rawData ?? '',
      forceAccuracy: req.forceAccuracy ?? false,
    })
  }

  await pipeSse('/api/import', { method: 'POST', headers, body, signal: req.signal }, req.onEvent)
}

/**
 * POST to /api/import/sheets as SSE. Same event shape as streamImport — caller
 * reuses the same onEvent handler, including the `complete` event which
 * additionally carries a `sheet: { title, tab, rowCount, truncated }` field.
 */
export async function streamImportSheets(req: SheetsSseRequest): Promise<void> {
  const headers: Record<string, string> = {
    accept: 'text/event-stream',
    'content-type': 'application/json',
  }
  const body = JSON.stringify({
    sheetUrl: req.sheetUrl,
    column: req.column,
    startRow: req.startRow,
    endRow: req.endRow,
    platform: req.platform ?? 'mixed',
    forceAccuracy: req.forceAccuracy ?? false,
  })
  await pipeSse('/api/import/sheets', { method: 'POST', headers, body, signal: req.signal }, req.onEvent)
}

async function pipeSse(
  url: string,
  init: RequestInit,
  onEvent: (e: SseEvent) => void,
): Promise<void> {
  const res = await fetch(url, init)

  if (!res.ok) {
    // Try JSON error first (server returns { error } for validation failures),
    // fall through to text body for transport errors.
    let message = `HTTP ${res.status}`
    try {
      const text = await res.text()
      try {
        const parsed = JSON.parse(text) as { error?: string }
        if (parsed?.error) message = parsed.error
      } catch {
        if (text) message = text
      }
    } catch { /* swallow */ }
    throw new Error(message)
  }
  if (!res.body) {
    throw new Error('No response body')
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let sepIndex
    while ((sepIndex = buffer.indexOf('\n\n')) !== -1) {
      const chunk = buffer.slice(0, sepIndex)
      buffer = buffer.slice(sepIndex + 2)
      const evt = parseSseChunk(chunk)
      if (evt) onEvent(evt)
    }
  }

  // Flush any trailing chunk.
  if (buffer.trim()) {
    const evt = parseSseChunk(buffer)
    if (evt) onEvent(evt)
  }
}

/** Fetch the service account email so the wizard can show it to admins. */
export async function fetchSheetsServiceAccountEmail(): Promise<string | null> {
  try {
    const res = await fetch('/api/import/sheets', { method: 'GET' })
    if (!res.ok) return null
    const json = (await res.json()) as { serviceAccountEmail?: string }
    return json.serviceAccountEmail ?? null
  } catch {
    return null
  }
}

function parseSseChunk(chunk: string): SseEvent | null {
  let event: string | null = null
  let dataRaw = ''
  for (const line of chunk.split(/\r?\n/)) {
    if (line.startsWith('event:')) event = line.slice(6).trim()
    else if (line.startsWith('data:')) dataRaw += line.slice(5).trim()
  }
  if (!event) return null
  try {
    const data = dataRaw ? JSON.parse(dataRaw) : {}
    return { event: event as FunnelEventName, data }
  } catch {
    return null
  }
}
