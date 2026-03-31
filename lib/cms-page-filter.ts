import type { CmsPageBundleId } from "@/lib/cms-page-bundles";
import { CMS_PAGE_BUNDLES, ALL_SITE_COPY_TOP_KEYS } from "@/lib/cms-page-bundles";

function pickTopLevelKeys(
  obj: Record<string, unknown> | undefined,
  keys: string[],
): Record<string, unknown> {
  if (!obj || typeof obj !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, k) && obj[k] !== undefined) {
      out[k] = obj[k];
    }
  }
  return out;
}

function resolveSiteCopyKeys(bundle: (typeof CMS_PAGE_BUNDLES)[CmsPageBundleId]): string[] {
  if (bundle.siteCopyKeys === "*") return [...ALL_SITE_COPY_TOP_KEYS];
  return bundle.siteCopyKeys;
}

/**
 * 페이지 번들에 맞게 locale별 messages / siteCopy 객체 축소 (추출용).
 */
export function filterExportByPageBundle(
  messagesByLocale: Record<string, unknown>,
  siteCopyByLocale: Record<string, unknown>,
  page: CmsPageBundleId,
): { messages: Record<string, unknown>; siteCopy: Record<string, unknown> } {
  const b = CMS_PAGE_BUNDLES[page];
  const msgKeys = b.messageKeys;
  const scKeys = resolveSiteCopyKeys(b);

  const messages: Record<string, unknown> = {};
  const siteCopy: Record<string, unknown> = {};

  for (const loc of Object.keys(messagesByLocale)) {
    messages[loc] = pickTopLevelKeys(messagesByLocale[loc] as Record<string, unknown>, msgKeys);
  }
  for (const loc of Object.keys(siteCopyByLocale)) {
    siteCopy[loc] = pickTopLevelKeys(siteCopyByLocale[loc] as Record<string, unknown>, scKeys);
  }

  return { messages, siteCopy };
}

/**
 * 적용 시: 선택한 페이지 번들에 해당하는 최상위 키만 남김(오붙여넣기 방지).
 */
export function filterImportBodyByPageBundle(
  body: {
    messages?: Record<string, unknown>;
    siteCopy?: Record<string, unknown>;
  },
  page: CmsPageBundleId,
): { messages?: Record<string, unknown>; siteCopy?: Record<string, unknown> } {
  const b = CMS_PAGE_BUNDLES[page];
  const msgKeys = b.messageKeys;
  const scKeys = resolveSiteCopyKeys(b);

  const messages: Record<string, unknown> = {};
  const siteCopy: Record<string, unknown> = {};

  if (body.messages) {
    for (const loc of Object.keys(body.messages)) {
      const picked = pickTopLevelKeys(body.messages[loc] as Record<string, unknown>, msgKeys);
      if (Object.keys(picked).length > 0) {
        messages[loc] = picked;
      }
    }
  }
  if (body.siteCopy) {
    for (const loc of Object.keys(body.siteCopy)) {
      const picked = pickTopLevelKeys(body.siteCopy[loc] as Record<string, unknown>, scKeys);
      if (Object.keys(picked).length > 0) {
        siteCopy[loc] = picked;
      }
    }
  }

  return {
    messages: Object.keys(messages).length > 0 ? messages : undefined,
    siteCopy: Object.keys(siteCopy).length > 0 ? siteCopy : undefined,
  };
}
