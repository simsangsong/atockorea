// AtoC 통합 Phase 2 — Resend Received API 본문 fetch (인메모리 전용, A-2).
// slice 2의 route-내장 헬퍼를 승격: webhook 라우트 + 리뷰 큐 [승인 커밋]이
// 같은 경로를 공유한다 (승인 = 원문 재fetch → commit 재실행 — PII 무저장 유지).

export function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** text 우선, 없으면 html 태그 제거 폴백. */
export function bodyTextFrom(data: Record<string, unknown>): string {
  const text = typeof data.text === 'string' ? data.text : typeof data.text_content === 'string' ? data.text_content : ''
  if (text.trim()) return text
  const html = typeof data.html === 'string' ? data.html : typeof data.html_content === 'string' ? data.html_content : ''
  return html ? stripHtml(html) : ''
}

export type ReceivedFetchResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; error: string }

/** Resend Received API로 수신 메일 원문 fetch — 반환값은 인메모리로만 사용하고
 *  절대 DB에 저장하지 않는다 (plan A-2). */
export async function fetchReceivedEmail(emailId: string): Promise<ReceivedFetchResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { ok: false, error: 'RESEND_API_KEY not configured' }
  try {
    const { Resend } = await import('resend')
    const resend = new Resend(apiKey)
    const { data, error } = await (resend.emails as unknown as {
      receiving: { get(id: string): Promise<{ data: Record<string, unknown> | null; error: { message?: string } | null }> }
    }).receiving.get(emailId)
    if (error || !data) return { ok: false, error: error?.message ?? 'empty Received API response' }
    return { ok: true, data }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Received API fetch failed' }
  }
}
