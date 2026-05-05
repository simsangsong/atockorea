/**
 * Visit Jeju SearchList 테스트 / 이미지 URL 추출용 CLI.
 *
 * 준비: 프로젝트 루트 `.env.local` 에 VISIT_JEJU_TOUR_API=...
 *
 * 실행 예:
 *   npx tsx scripts/visitjeju-search.ts --cid CONT_000000000500349
 *   npx tsx scripts/visitjeju-search.ts --category c1 --page 2
 *   npx tsx scripts/visitjeju-search.ts --keyword 함덕           # 추가 파라미터(서버가 지원하면)
 *
 * 공식 문서에는 keyword가 없거나 별개일 수 있습니다. 미지원이면 결과가 비거나 오류입니다.
 */

import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import {
  collectAllImageUrlsDeep,
  extractRepPhotoUrls,
  fetchVisitJejuSearchList,
  type VisitJejuContentItem,
} from "../lib/visitjeju/contentSearch";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- tsx 실행 시 import.meta 존재
// @ts-expect-error import.meta.url under tsx
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function loadEnvLocalDotenvStyle() {
  const p = join(ROOT, ".env.local");
  if (!existsSync(p)) return;
  const txt = readFileSync(p, "utf8");
  for (const line of txt.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined || process.env[key] === "") {
      process.env[key] = val;
    }
  }
}

function argvFlag(flag: string): string | undefined {
  const ix = process.argv.indexOf(flag);
  if (ix >= 0 && process.argv[ix + 1]) return process.argv[ix + 1];
  return undefined;
}

function hasQuiet(): boolean {
  return process.argv.includes("--quiet") || process.argv.includes("-q");
}

loadEnvLocalDotenvStyle();

async function main() {
  const cid = argvFlag("--cid");
  const page = argvFlag("--page") ? parseInt(argvFlag("--page")!, 10) : undefined;
  const locale = argvFlag("--locale") || argvFlag("--lang");
  const category = argvFlag("--category") || argvFlag("--cat");
  const keyword = argvFlag("--keyword") || argvFlag("--kw");
  const limit = argvFlag("--limit") ? parseInt(argvFlag("--limit")!, 10) : undefined;

  const extraQuery: Record<string, string> = {};
  if (keyword) extraQuery.keyword = keyword;

  const data = await fetchVisitJejuSearchList({
    cid,
    page: Number.isFinite(page as number) ? page : 1,
    locale: locale ?? "kr",
    category: category ?? undefined,
    extraQuery: Object.keys(extraQuery).length ? extraQuery : undefined,
  });

  const items: VisitJejuContentItem[] = Array.isArray(data.items) ? data.items : [];
  const summary = items.map((item) => {
    const rep = extractRepPhotoUrls(item);
    const deep = collectAllImageUrlsDeep(item, 32);
    return {
      contentsid: item.contentsid,
      title: item.title,
      repPhotoUrls: rep,
      allImageUrls: deep.length > rep.length ? deep : undefined,
      imageCountDeep: deep.length,
    };
  });

  const out = hasQuiet()
    ? JSON.stringify(summary, null, 2)
    : JSON.stringify(
        {
          paging: {
            totalCount: data.totalCount,
            resultCount: data.resultCount,
            pageSize: data.pageSize,
            pageCount: data.pageCount,
            currentPage: data.currentPage,
          },
          items: limit != null && Number.isFinite(limit) ? summary.slice(0, limit) : summary,
          note:
            "문서형 SearchList 기본 응답은 대표 1매(repPhoto). 다수 장은 응답에 갤러리 노드가 있을 때만 allImageUrls에 잡힙니다.",
        },
        null,
        2
      );

  process.stdout.write(out + "\n");
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
