/**
 * Kakao / pipeline zip: work_atoc_fixed_v2/{es,ja,ko,zhcn,zhtw}/*.json
 * → components/product-tour-static/<slug>/<slug>.<locale>.json
 *
 *   npx tsx scripts/apply-atoc-locale-bundle.ts --zip "C:\path\to\atoc_json_system_ai_tone_fixed_20260505.zip"
 *   npx tsx scripts/apply-atoc-locale-bundle.ts --root "C:\path\to\work_atoc_fixed_v2"
 *   npx tsx scripts/apply-atoc-locale-bundle.ts --zip "..." --dry-run
 */

import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "fs";
import { basename, dirname, join } from "path";
import { tmpdir } from "os";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- tsx ESM
// @ts-expect-error import.meta.url
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const STATIC = join(ROOT, "components", "product-tour-static");

const DIR_TO_FILE_LOCALE: Record<string, string> = {
  es: "es",
  ja: "ja",
  ko: "ko",
  zhcn: "zh",
  zhtw: "zh-TW",
};

const SUFFIX_BY_DIR: Record<string, string> = {
  es: "es",
  ja: "ja",
  ko: "ko",
  zhcn: "zhcn",
  zhtw: "zhtw",
};

const FILENAME_RE = /^(.+)_(es|ja|ko|zhcn|zhtw)\.json$/i;

function argvFlag(flag: string): string | undefined {
  const ix = process.argv.indexOf(flag);
  if (ix >= 0 && process.argv[ix + 1]) return process.argv[ix + 1];
  return undefined;
}

function findWorkAtocRoot(searchUnder: string): string {
  const direct = join(searchUnder, "work_atoc_fixed_v2");
  if (existsSync(direct)) return direct;
  const entries = readdirSync(searchUnder, { withFileTypes: true }).filter((d) => d.isDirectory());
  for (const e of entries) {
    const nested = join(searchUnder, e.name, "work_atoc_fixed_v2");
    if (existsSync(nested)) return nested;
  }
  throw new Error(`work_atoc_fixed_v2 not found under ${searchUnder}`);
}

function extractZipToTemp(zipPath: string): string {
  const dir = mkdtempSync(join(tmpdir(), "atoc_locale_apply_"));
  try {
    execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        `Expand-Archive -LiteralPath ${JSON.stringify(zipPath)} -DestinationPath ${JSON.stringify(dir)} -Force`,
      ],
      { stdio: "inherit" }
    );
  } catch {
    rmSync(dir, { recursive: true, force: true });
    throw new Error(`Failed to extract zip: ${zipPath}`);
  }
  return dir;
}

function normalizeLocaleField(doc: Record<string, unknown>, fileLocale: string) {
  if (fileLocale === "zh") {
    doc.locale = "zh-CN";
  } else if (fileLocale === "zh-TW") {
    doc.locale = "zh-TW";
  } else {
    doc.locale = fileLocale;
  }
}

function main() {
  const dryRun = process.argv.includes("--dry-run") || process.argv.includes("-n");
  const zip = argvFlag("--zip");
  const rootArg = argvFlag("--root");

  let extractDir: string | null = null;
  let workRoot: string;

  try {
    if (zip) {
      if (!existsSync(zip)) {
        console.error("Zip not found:", zip);
        process.exit(1);
      }
      extractDir = extractZipToTemp(zip);
      workRoot = findWorkAtocRoot(extractDir);
    } else if (rootArg) {
      workRoot = rootArg.endsWith("work_atoc_fixed_v2") ? rootArg : findWorkAtocRoot(rootArg);
    } else {
      console.error("Usage: --zip <path> | --root <work_atoc_fixed_v2 or parent>");
      process.exit(1);
    }

    if (!existsSync(workRoot)) {
      console.error("work root missing:", workRoot);
      process.exit(1);
    }

    console.log(dryRun ? "[dry-run] no writes" : "Applying locale JSON", "\nfrom", workRoot, "\nto", STATIC);

    let written = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const dirName of Object.keys(DIR_TO_FILE_LOCALE)) {
      const srcDir = join(workRoot, dirName);
      if (!existsSync(srcDir)) {
        console.warn("skip missing folder:", srcDir);
        continue;
      }
      const fileLocale = DIR_TO_FILE_LOCALE[dirName];
      const files = readdirSync(srcDir).filter((f) => f.endsWith(".json"));
      for (const file of files) {
        const m = file.match(FILENAME_RE);
        if (!m) {
          errors.push(`bad filename (${dirName}/${file})`);
          continue;
        }
        const slug = m[1];
        const suffix = m[2].toLowerCase();
        if (suffix !== SUFFIX_BY_DIR[dirName]) {
          errors.push(`suffix mismatch ${dirName} vs ${file}`);
          continue;
        }
        const destDir = join(STATIC, slug);
        const destPath = join(destDir, `${slug}.${fileLocale}.json`);
        if (!existsSync(destDir)) {
          errors.push(`no target dir for slug=${slug}`);
          skipped += 1;
          continue;
        }
        let text: string;
        try {
          text = readFileSync(join(srcDir, file), "utf8");
        } catch (e) {
          errors.push(`read ${file}: ${e}`);
          continue;
        }
        let doc: Record<string, unknown>;
        try {
          doc = JSON.parse(text) as Record<string, unknown>;
        } catch (e) {
          errors.push(`parse ${slug}.${fileLocale}: ${e}`);
          continue;
        }
        normalizeLocaleField(doc, fileLocale);

        const out = `${JSON.stringify(doc, null, 2)}\n`;
        if (!dryRun) writeFileSync(destPath, out, "utf8");
        console.log(`${dryRun ? "[dry-run] " : ""}OK ${slug}.${fileLocale}.json`);
        written += 1;
      }
    }

    console.log("\nDone.", { written, skipped, errors: errors.length });
    if (errors.length) console.warn(errors.slice(0, 40).join("\n"), errors.length > 40 ? `\n…+${errors.length - 40} more` : "");
  } finally {
    if (extractDir && existsSync(extractDir)) {
      rmSync(extractDir, { recursive: true, force: true });
    }
  }
}

main();
