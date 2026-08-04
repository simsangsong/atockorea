#!/usr/bin/env node
/**
 * One-command applier for the 2026-08-04 tour-catalog revision.
 *
 *   npm run tours:apply-2026-08-04 -- --dry-run   # plan only, no DB writes
 *   npm run tours:apply-2026-08-04                # apply for real
 *   npm run tours:apply-2026-08-04 -- --skip-sql  # SQL already applied by hand;
 *                                                 # just sync match_tours + verify
 *
 * Steps
 *   0) Preflight — env, SQL files, 10 static bundles parse & agree on price
 *      (Busan + both Seoul products), and each SQL carries its bundle's price
 *   1) Apply supabase/pending-db-apply/2026-08-04-{01..11}.sql IN FILENAME ORDER
 *      (needs `psql` + a Postgres connection string; see --skip-sql otherwise)
 *   2) Sync the recommender: import-match-v18.mjs --single <slug> × 8
 *   3) Verify over supabase-js: tours.is_active + price, page publish flags per
 *      locale, the two Busan offers, match_tours presence
 *   4) Move applied SQL into supabase/pending-db-apply/applied/
 *
 * Env (from .env.local via `node --env-file=.env.local`, or the shell):
 *   NEXT_PUBLIC_SUPABASE_URL | SUPABASE_URL      — required
 *   SUPABASE_SERVICE_ROLE_KEY | SUPABASE_SERVICE_KEY — required
 *   SUPABASE_DB_URL | DATABASE_URL | POSTGRES_URL — required unless --skip-sql
 *
 * Re-running is safe: every SQL file is idempotent (ON CONFLICT), the match
 * import upserts, and already-applied files are skipped once moved.
 */
import { readFileSync, existsSync, renameSync, mkdirSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PENDING = path.join(ROOT, "supabase/pending-db-apply");
const APPLIED = path.join(PENDING, "applied");

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const SKIP_SQL = args.includes("--skip-sql");

const SQL_FILES = [
  "2026-08-04-01-jeju-course-revision-activation.sql",
  "2026-08-04-02-jeju-eastern-unesco-reorder.sql",
  "2026-08-04-03-busan-smallgroup-new-product.sql",
  "2026-08-04-04-busan-smallgroup-staged-locales.sql",
  "2026-08-04-05-pocheon-geopark-recourse.sql",
  "2026-08-04-06-pocheon-geopark-staged-locales.sql",
  "2026-08-04-07-gyeongju-recourse.sql",
  "2026-08-04-08-seoul-gapyeong-new-product.sql",
  "2026-08-04-09-seoul-gapyeong-staged-locales.sql",
  "2026-08-04-10-seoul-winter-eobi-new-product.sql",
  "2026-08-04-11-seoul-winter-eobi-staged-locales.sql",
];

const BUSAN = "busan-small-group-yonggungsa-skycapsule-gamcheon-tour";
const GAPYEONG = "seoul-gapyeong-nami-morning-calm-petite-france-day-tour";
const WINTER = "seoul-winter-seoraksan-nami-eobi-ice-valley-day-tour";
const EAST = "jeju-eastern-unesco-spots-day-tour";
const SOUTH = "jeju-southern-top-unesco-spots-tour";
const SOUTHWEST = "southwest-hallasan-osulloc-aewol";
const POCHEON = "pocheon-sanjeong-lake-herb-island-art-valley";
const GYEONGJU = "from-busan-gyeongju-ancient-capital-day-tour";
// Pocheon and Gyeongju were re-coursed the same day (SQL 05/06 and 07). Their
// match_tours rows still hold the OLD itineraries until this import runs —
// Gyeongju included, even though it stays hidden from consumer surfaces: a
// blocked SKU with a stale course is still wrong data for the recommender.
// The two Seoul-departure products (SQL 08-11) are new INSERTs, so they need a
// match_tours row built from scratch — same as Busan did.
const MATCH_SLUGS = [EAST, SOUTH, SOUTHWEST, BUSAN, POCHEON, GYEONGJU, GAPYEONG, WINTER];
const HYDRANGEA = [
  "jeju-hydrangea-festival-tour-east-route",
  "jeju-hydrangea-festival-tour-southwest-route",
];
const CONTENT_LOCALES = ["en", "ko", "ja", "zh", "zh-TW", "es"];
const STAGED_LOCALES = ["de", "fr", "it", "ru"];

const C = {
  b: (s) => `[1m${s}[0m`,
  g: (s) => `[32m${s}[0m`,
  r: (s) => `[31m${s}[0m`,
  y: (s) => `[33m${s}[0m`,
  dim: (s) => `[2m${s}[0m`,
};
const say = (s = "") => console.log(s);
const step = (n, t) => say(`\n${C.b(`[${n}]`)} ${C.b(t)}`);
const ok = (s) => say(`  ${C.g("✓")} ${s}`);
const warn = (s) => say(`  ${C.y("!")} ${s}`);
const bad = (s) => say(`  ${C.r("✗")} ${s}`);

function die(msg, hint) {
  bad(msg);
  if (hint) say(`\n${hint}`);
  process.exit(1);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";
const DB_URL =
  process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL || "";

// ---------------------------------------------------------------------------
// 0) Preflight
// ---------------------------------------------------------------------------
step(0, "Preflight");

const pendingFiles = SQL_FILES.filter((f) => existsSync(path.join(PENDING, f)));
const alreadyApplied = SQL_FILES.filter((f) => existsSync(path.join(APPLIED, f)));
if (!pendingFiles.length && alreadyApplied.length === SQL_FILES.length) {
  ok("all four SQL files are already in applied/ — nothing to apply");
} else if (!pendingFiles.length) {
  die(
    `no 2026-08-04 SQL found in ${path.relative(ROOT, PENDING)}`,
    `Expected:\n${SQL_FILES.map((f) => `  ${f}`).join("\n")}\n` +
      `If they were moved already, this run has nothing to do.`,
  );
} else {
  ok(`${pendingFiles.length} SQL file(s) pending: ${pendingFiles.join(", ")}`);
  if (alreadyApplied.length) warn(`already applied earlier: ${alreadyApplied.join(", ")}`);
}

// Static bundles must parse and agree with the price the SQL carries.
const allLocales = [...CONTENT_LOCALES, ...STAGED_LOCALES];

/** Parse all 10 locale bundles for a slug and return the single price they agree on. */
function bundlePrice(slug, label) {
  const dir = path.join(ROOT, "components/product-tour-static", slug);
  const missing = allLocales.filter((l) => !existsSync(path.join(dir, `${slug}.${l}.json`)));
  if (missing.length) die(`${label} bundles missing for: ${missing.join(", ")}`);
  const found = new Set(
    allLocales.map((l) => {
      const j = JSON.parse(readFileSync(path.join(dir, `${slug}.${l}.json`), "utf8"));
      return String(j.price?.salePriceUsd);
    }),
  );
  if (found.size !== 1) die(`${label} bundles disagree on price: ${[...found].join(" / ")}`);
  ok(`${label} bundles: 10 locales parse, price USD ${[...found][0]} everywhere`);
  return [...found][0];
}

const prices = new Set([bundlePrice(BUSAN, "Busan")]);
const gapyeongPrice = bundlePrice(GAPYEONG, "Seoul→Gapyeong");
const winterPrice = bundlePrice(WINTER, "Seoul winter/Eobi");

const sql03 = pendingFiles.includes(SQL_FILES[2])
  ? readFileSync(path.join(PENDING, SQL_FILES[2]), "utf8")
  : "";
if (sql03) {
  const base = Number([...prices][0]) * 100;
  if (!sql03.includes(`${base}, 'USD'`)) {
    die(
      `SQL 03 does not carry the bundle price (${base} minor units)`,
      `Regenerate it:  node scripts/gen-busan-smallgroup-sql-2026-08.mjs`,
    );
  }
  ok(`SQL 03 offers match the bundle price (${base} + ticket-included row)`);
}

// Same guard for the two Seoul products: the offers row in each SQL must carry
// the price its bundles carry, or the page and the checkout disagree.
for (const [file, price, label, regen] of [
  [SQL_FILES[7], gapyeongPrice, "SQL 08 (Seoul→Gapyeong)", "build-seoul-gapyeong-2026-08.mjs"],
  [SQL_FILES[9], winterPrice, "SQL 10 (Seoul winter/Eobi)", "build-seoul-winter-eobi-2026-08.mjs"],
]) {
  if (!pendingFiles.includes(file)) continue;
  const body = readFileSync(path.join(PENDING, file), "utf8");
  const minor = Number(price) * 100;
  if (!body.includes(`${minor}, 'USD'`)) {
    die(
      `${label} does not carry the bundle price (${minor} minor units)`,
      `Regenerate it:  node scripts/${regen} && node scripts/gen-seoul-new-products-sql-2026-08.mjs`,
    );
  }
  ok(`${label} offers match the bundle price (${minor})`);
}

if (!SUPABASE_URL || !SERVICE_KEY) {
  die(
    "missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY",
    `Run with the env file:\n` +
      `  ${C.b("node --env-file=.env.local scripts/apply-tour-catalog-2026-08-04.mjs")}\n` +
      `(that is what ${C.b("npm run tours:apply-2026-08-04")} does)`,
  );
}
ok(`Supabase project: ${SUPABASE_URL.replace(/^https?:\/\//, "").split(".")[0]}`);

if (DRY) say(`\n${C.y("DRY RUN")} — no writes. Plan follows.`);

// ---------------------------------------------------------------------------
// 1) Apply SQL in filename order
// ---------------------------------------------------------------------------
step(1, `Apply SQL (${pendingFiles.length} file(s), in filename order)`);

const appliedNow = [];
if (SKIP_SQL) {
  warn("--skip-sql: assuming the SQL was already applied by hand (MCP / SQL editor)");
} else if (DRY) {
  for (const f of pendingFiles) {
    const body = readFileSync(path.join(PENDING, f), "utf8");
    const stmts = (body.match(/^(INSERT|UPDATE|DELETE)/gim) || []).length;
    say(`  ${C.dim("would apply")} ${f} ${C.dim(`(${stmts} write statements)`)}`);
  }
} else {
  const hasPsql = spawnSync("psql", ["--version"], { stdio: "ignore" }).status === 0;
  if (!hasPsql || !DB_URL) {
    die(
      hasPsql ? "no Postgres connection string in env" : "`psql` not found on PATH",
      `Two ways forward:\n\n` +
        `  ${C.b("A) give this script a connection string")} (Supabase dashboard →\n` +
        `     Project Settings → Database → Connection string → URI), then re-run:\n` +
        `       SUPABASE_DB_URL='postgresql://...' npm run tours:apply-2026-08-04\n\n` +
        `  ${C.b("B) apply the SQL yourself")} — paste these files IN ORDER into the\n` +
        `     Supabase SQL editor (or have Claude apply them over the Supabase MCP):\n` +
        pendingFiles.map((f) => `       supabase/pending-db-apply/${f}`).join("\n") +
        `\n     then finish the rest with:\n` +
        `       npm run tours:apply-2026-08-04 -- --skip-sql`,
    );
  }
  for (const f of pendingFiles) {
    process.stdout.write(`  applying ${f} … `);
    const res = spawnSync(
      "psql",
      [DB_URL, "-v", "ON_ERROR_STOP=1", "--quiet", "-f", path.join(PENDING, f)],
      { encoding: "utf8" },
    );
    if (res.status !== 0) {
      say(C.r("FAILED"));
      say(res.stderr || res.stdout || "(no output)");
      die(
        `${f} failed — nothing after it was applied`,
        `Each file is a single transaction, so the DB is unchanged by this file.\n` +
          `Fix the cause, then re-run: npm run tours:apply-2026-08-04`,
      );
    }
    say(C.g("ok"));
    appliedNow.push(f);
  }
}

// ---------------------------------------------------------------------------
// 2) Recommender sync
// ---------------------------------------------------------------------------
step(2, `Sync match_tours (${MATCH_SLUGS.length} slugs)`);

if (DRY) {
  for (const slug of MATCH_SLUGS) say(`  ${C.dim("would run")} import-match-v18.mjs --single ${slug}`);
} else {
  for (const slug of MATCH_SLUGS) {
    process.stdout.write(`  ${slug} … `);
    const res = spawnSync(
      process.execPath,
      [path.join(ROOT, "scripts/import-match-v18.mjs"), "--single", slug],
      { encoding: "utf8", env: { ...process.env, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY } },
    );
    if (res.status !== 0) {
      say(C.r("FAILED"));
      say((res.stderr || res.stdout || "").trim().split("\n").slice(-12).join("\n"));
      die(
        `match sync failed for ${slug}`,
        `The SQL above it is already applied and idempotent — re-running the whole\n` +
          `command after fixing this is safe.`,
      );
    }
    say(C.g("ok"));
  }
}

// ---------------------------------------------------------------------------
// 3) Verify
// ---------------------------------------------------------------------------
step(3, "Verify");

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
let failures = 0;
const check = (cond, msg) => {
  if (cond) ok(msg);
  else {
    bad(msg);
    failures += 1;
  }
};

if (DRY) {
  say(`  ${C.dim("would verify")} tours flags · page publish flags · Busan offers · match_tours`);
} else {
  const { data: tours, error: e1 } = await sb
    .from("tours")
    .select("slug,is_active,price")
    .in("slug", [...MATCH_SLUGS, ...HYDRANGEA]);
  if (e1) die(`tours query failed: ${e1.message}`);
  const bySlug = Object.fromEntries((tours ?? []).map((t) => [t.slug, t]));

  for (const s of HYDRANGEA) {
    check(bySlug[s] ? bySlug[s].is_active === false : true, `hydrangea down: ${s}`);
  }
  for (const s of [EAST, SOUTH, SOUTHWEST]) {
    check(bySlug[s]?.is_active === true, `active: ${s}`);
  }
  check(bySlug[BUSAN]?.is_active === true, `active: ${BUSAN}`);
  check(
    Number(bySlug[BUSAN]?.price) === Number([...prices][0]),
    `Busan tours.price = USD ${bySlug[BUSAN]?.price ?? "—"} (bundle says ${[...prices][0]})`,
  );

  const { data: pages, error: e2 } = await sb
    .from("tour_product_pages")
    .select("slug,locale,is_published")
    .in("slug", [...MATCH_SLUGS]);
  if (e2) die(`tour_product_pages query failed: ${e2.message}`);
  const localesOf = (slug) =>
    (pages ?? []).filter((p) => p.slug === slug && p.is_published).map((p) => p.locale).sort();

  for (const s of [EAST, SOUTH, SOUTHWEST]) {
    const got = localesOf(s);
    check(
      CONTENT_LOCALES.every((l) => got.includes(l)),
      `${s}: published locales ${got.join(",") || "(none)"}`,
    );
  }
  const busanLocales = localesOf(BUSAN);
  check(
    CONTENT_LOCALES.every((l) => busanLocales.includes(l)),
    `${BUSAN}: content locales ${CONTENT_LOCALES.filter((l) => busanLocales.includes(l)).join(",")}`,
  );
  const stagedGot = STAGED_LOCALES.filter((l) => busanLocales.includes(l));
  check(
    stagedGot.length === STAGED_LOCALES.length,
    `${BUSAN}: staged locales ${stagedGot.join(",") || "(none)"} ` +
      `${C.dim("(rows exist; guests still see EN until the fallback gate opens)")}`,
  );

  const { data: enPage } = await sb
    .from("tour_product_pages")
    .select("id")
    .eq("slug", BUSAN)
    .eq("locale", "en")
    .maybeSingle();
  if (enPage?.id) {
    const { data: offers } = await sb
      .from("tour_product_offers")
      .select("label,amount_minor,is_default,is_active")
      .eq("tour_product_page_id", enPage.id);
    const act = (offers ?? []).filter((o) => o.is_active);
    const def = act.find((o) => o.is_default);
    const inc = act.find((o) => !o.is_default);
    check(act.length === 2, `Busan offers: ${act.length} active (expected 2)`);
    check(
      Number(def?.amount_minor) === Number([...prices][0]) * 100,
      `  default (capsule excluded): ${def ? def.amount_minor / 100 : "—"} USD`,
    );
    check(Number(inc?.amount_minor) === 7900, `  ticket included: ${inc ? inc.amount_minor / 100 : "—"} USD`);
  } else {
    check(false, "Busan EN page row not found — offers unverified");
  }

  // Seoul-departure products: same shape as Busan — 6 content locales live,
  // 4 staged locales present as rows only (guests still get EN until the
  // TOUR_PRODUCT_FALLBACK_URL_LOCALES gate opens, which is an owner decision).
  for (const [slug, price, label] of [
    [GAPYEONG, gapyeongPrice, "Seoul→Gapyeong"],
    [WINTER, winterPrice, "Seoul winter/Eobi"],
  ]) {
    check(bySlug[slug]?.is_active === true, `active: ${slug}`);
    check(
      Number(bySlug[slug]?.price) === Number(price),
      `${label} tours.price = USD ${bySlug[slug]?.price ?? "—"} (bundle says ${price})`,
    );
    const got = localesOf(slug);
    const contentGot = CONTENT_LOCALES.filter((l) => got.includes(l));
    check(
      contentGot.length === CONTENT_LOCALES.length,
      `${label}: content locales ${contentGot.join(",") || "(none)"}`,
    );
    const staged = STAGED_LOCALES.filter((l) => got.includes(l));
    check(
      staged.length === STAGED_LOCALES.length,
      `${label}: staged locales ${staged.join(",") || "(none)"} ` +
        `${C.dim("(rows exist; guests still see EN until the fallback gate opens)")}`,
    );
  }

  const { data: mt, error: e3 } = await sb.from("match_tours").select("slug").in("slug", MATCH_SLUGS);
  if (e3) warn(`match_tours query failed (${e3.message}) — skipped`);
  else {
    const got = new Set((mt ?? []).map((r) => r.slug));
    for (const s of MATCH_SLUGS) check(got.has(s), `match_tours row: ${s}`);
  }
}

// ---------------------------------------------------------------------------
// 4) Move applied files
// ---------------------------------------------------------------------------
step(4, "Archive applied SQL");

if (DRY || SKIP_SQL || !appliedNow.length) {
  say(
    `  ${C.dim(
      DRY
        ? "would move applied files into pending-db-apply/applied/"
        : SKIP_SQL
          ? "--skip-sql: leaving files in place (move them yourself once confirmed)"
          : "nothing newly applied",
    )}`,
  );
} else if (failures) {
  warn(`${failures} verification failure(s) — leaving SQL in pending/ for a retry`);
} else {
  mkdirSync(APPLIED, { recursive: true });
  for (const f of appliedNow) {
    renameSync(path.join(PENDING, f), path.join(APPLIED, f));
    ok(`moved ${f} → applied/`);
  }
  const left = readdirSync(PENDING).filter((f) => f.endsWith(".sql"));
  say(`  ${C.dim(`${left.length} SQL file(s) still pending in that folder`)}`);
}

// ---------------------------------------------------------------------------
say("");
if (DRY) {
  say(`${C.y("Dry run complete.")} Re-run without --dry-run to apply.`);
} else if (failures) {
  say(`${C.r(`${failures} check(s) failed.`)} See docs/NEXT-SESSION-TOUR-CATALOG-2026-08-04.md §2.`);
  process.exit(1);
} else {
  say(`${C.g("Done.")} Jeju East/South/Southwest + the new Busan tour are live end-to-end.`);
  say(
    C.dim(
      "Remaining human gates: de/fr/it/ru fallback-gate decision, Daritdol/Dakbatgol photos,\n" +
        "Sky Capsule ticket-option ops procedure. See the handoff doc §5.",
    ),
  );
}
