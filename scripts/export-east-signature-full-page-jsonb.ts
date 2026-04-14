/**
 * East Signature tour product 페이지 전체를 단일 JSONB 호환 JSON 파일로 출력.
 *
 *   npx tsx scripts/export-east-signature-full-page-jsonb.ts
 *   npx tsx scripts/export-east-signature-full-page-jsonb.ts path/to/out.json
 *
 * 출력: supabase/manual/generated/east-signature-nature-core-full-page.json (기본)
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { buildEastSignatureFullPageJsonbDocument } from "../components/product-tour-static/east-signature-nature-core/buildDetailPayloadForSeed";

const defaultOut = join(
  process.cwd(),
  "supabase/manual/generated/east-signature-nature-core-full-page.json"
);
const outPath = process.argv[2] ? join(process.cwd(), process.argv[2]) : defaultOut;

const doc = buildEastSignatureFullPageJsonbDocument();
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
console.log(outPath);
