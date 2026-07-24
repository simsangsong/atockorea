// AtoC 통합 플랜 §6.3 (감사 G2) — 정산 PDF 생성·보관.
//
// ops_no_show_evidence와 같은 저장 정책: **private 버킷 + 단기 서명 URL.**
// DB에는 URL이 아니라 storage path를 적는다(서명 URL은 만료되므로 컬럼에 넣으면
// 곧 죽은 링크가 된다). `ops_intercompany_invoices.pdf_url`은 이제 이 경로를
// 담고, 월 정산서는 `ops_settlement_periods.statement_pdf_path`에 담는다.
//
// 🔴 D10 — 생성하고 보관할 뿐이다. 이 모듈은 아무 데도 제출·발송하지 않는다.

import type { InvoiceDoc, StatementDoc } from '../documents'
import { renderInvoicePdf, renderStatementPdf } from './documents.server'
import {
  FINANCE_DOCS_BUCKET,
  FINANCE_DOC_SIGNED_URL_TTL_SEC,
  financeDocPath,
  pathStamp,
  type FinanceDocKind,
} from './paths'

/** Minimal client shape — routes pass createServerClient() directly. */
export interface FinanceDocStorageClient {
  storage: {
    listBuckets(): Promise<{ data: Array<{ name: string }> | null }>
    createBucket(name: string, options: Record<string, unknown>): Promise<{ error: unknown }>
    from(bucket: string): {
      upload(
        path: string,
        body: Buffer,
        options: Record<string, unknown>,
      ): Promise<{ error: unknown }>
      createSignedUrl(
        path: string,
        expiresIn: number,
      ): Promise<{ data: { signedUrl: string } | null; error: unknown }>
    }
  }
}

/** private 버킷 보장 — public:false가 이 슬라이스의 핵심 불변식이다. */
export async function ensureFinanceDocsBucket(supabase: FinanceDocStorageClient): Promise<void> {
  const { data: buckets } = await supabase.storage.listBuckets()
  if (!buckets?.some((bucket) => bucket.name === FINANCE_DOCS_BUCKET)) {
    await supabase.storage.createBucket(FINANCE_DOCS_BUCKET, {
      public: false,
      fileSizeLimit: 10 * 1024 * 1024,
    })
  }
}

/** 단기 서명 URL. 실패는 조회를 막지 않는다(경로는 이미 DB에 남아 있다). */
export async function financeDocSignedUrl(
  supabase: FinanceDocStorageClient,
  path: string | null | undefined,
  expiresInSec = FINANCE_DOC_SIGNED_URL_TTL_SEC,
): Promise<string | null> {
  if (!path) return null
  try {
    const { data, error } = await supabase.storage
      .from(FINANCE_DOCS_BUCKET)
      .createSignedUrl(path, expiresInSec)
    if (error || !data?.signedUrl) return null
    return data.signedUrl
  } catch {
    return null
  }
}

export interface StoredFinanceDoc {
  kind: FinanceDocKind
  /** private 버킷 안의 객체 경로 — DB에 저장되는 값. */
  path: string
  bytes: number
  generatedAt: string
  draft: boolean
  signedUrl: string | null
}

async function storePdf(
  supabase: FinanceDocStorageClient,
  input: { kind: FinanceDocKind; period: string; invoiceNo?: string | null; draft: boolean; bytes: Buffer },
): Promise<StoredFinanceDoc> {
  const generatedAt = new Date().toISOString()
  const objectPath = financeDocPath({
    kind: input.kind,
    period: input.period,
    invoiceNo: input.invoiceNo ?? null,
    stamp: pathStamp(generatedAt),
  })

  await ensureFinanceDocsBucket(supabase)
  const { error } = await supabase.storage.from(FINANCE_DOCS_BUCKET).upload(objectPath, input.bytes, {
    contentType: 'application/pdf',
    upsert: false,
  })
  if (error) throw error instanceof Error ? error : new Error('finance pdf upload failed')

  return {
    kind: input.kind,
    path: objectPath,
    bytes: input.bytes.length,
    generatedAt,
    draft: input.draft,
    signedUrl: await financeDocSignedUrl(supabase, objectPath),
  }
}

/** 월 정산서 PDF 생성 → private 버킷 보관. 반환 경로를 호출부가 DB에 적는다. */
export async function generateStatementPdf(
  supabase: FinanceDocStorageClient,
  doc: StatementDoc,
): Promise<StoredFinanceDoc> {
  const bytes = await renderStatementPdf(doc)
  return storePdf(supabase, { kind: 'statement', period: doc.period, draft: doc.draft, bytes })
}

/** 인터컴퍼니 인보이스 PDF 생성 → private 버킷 보관. */
export async function generateInvoicePdf(
  supabase: FinanceDocStorageClient,
  doc: InvoiceDoc,
): Promise<StoredFinanceDoc> {
  const bytes = await renderInvoicePdf(doc)
  return storePdf(supabase, {
    kind: 'invoice',
    period: doc.period,
    invoiceNo: doc.invoiceNo,
    draft: doc.draft,
    bytes,
  })
}
