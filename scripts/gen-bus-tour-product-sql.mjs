/**
 * Bus-tour SQL batch generator.
 *
 * Generates `insert-<slug>-product.generated.sql` files for the bus-tour
 * bundles registered in this chat.
 *
 * Usage:
 *   node scripts/gen-bus-tour-product-sql.mjs
 *   node scripts/gen-bus-tour-product-sql.mjs south-jeju-classic-bus-tour
 *   node scripts/gen-bus-tour-product-sql.mjs south-jeju-classic-bus-tour east-jeju-classic-bus-tour
 */

import { existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const BUS_TOUR_SLUGS = [
  "south-jeju-classic-bus-tour",
  "southwest-jeju-scenic-bus-tour",
  "east-jeju-classic-bus-tour",
  "jeju-cruise-shore-excursion-bus-tour",
  "jeju-cruise-shore-excursion-small-group-tour",
];

function resolveTargets(argv) {
  const requested = argv.slice(2).map((s) => String(s).trim()).filter(Boolean);
  if (requested.length === 0) return BUS_TOUR_SLUGS;
  const unknown = requested.filter((slug) => !BUS_TOUR_SLUGS.includes(slug));
  if (unknown.length > 0) {
    console.error(
      `[gen-bus-tour-product-sql] unsupported slug(s): ${unknown.join(", ")}\n` +
        `Allowed: ${BUS_TOUR_SLUGS.join(", ")}`,
    );
    process.exit(1);
  }
  return requested;
}

function ensureBundleExists(slug) {
  const p = join(root, `components/product-tour-static/${slug}/${slug}.en.json`);
  if (!existsSync(p)) {
    console.error(`[gen-bus-tour-product-sql] missing source bundle: ${p}`);
    process.exit(1);
  }
}

function run() {
  const targets = resolveTargets(process.argv);
  for (const slug of targets) {
    ensureBundleExists(slug);
    const outPath = join(root, `supabase/manual/insert-${slug}-product.generated.sql`);
    const cmdArgs = [
      "scripts/gen-tour-product-sql.mjs",
      slug,
      "--out",
      outPath,
    ];
    const proc = spawnSync("node", cmdArgs, {
      cwd: root,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    if (proc.status !== 0) {
      process.exit(proc.status ?? 1);
    }
  }
}

run();
