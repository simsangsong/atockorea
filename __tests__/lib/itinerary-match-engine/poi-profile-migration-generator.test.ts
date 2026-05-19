import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { generateMigrationSql } from "../../../scripts/generate-itinerary-builder-poi-profile-migration";

describe("itinerary builder POI profile migration generator", () => {
  it("keeps the checked-in migration in sync with profile and taxonomy seeds", () => {
    const migrationPath = resolve(
      process.cwd(),
      "supabase/migrations/20260518143000_promote_itinerary_builder_poi_profiles.sql",
    );
    const migrationSql = readFileSync(migrationPath, "utf8").replace(/\r\n/g, "\n");

    expect(generateMigrationSql()).toBe(migrationSql);
  });

  it("keeps non-curated builder POIs hidden instead of preserving old stop roles", () => {
    const sql = generateMigrationSql();

    expect(sql).toContain("  stop_role = 'hidden',");
    expect(sql).not.toContain("stop_role = COALESCE(stop_role, 'hidden')");
  });
});
