-- Premium v2 tour detail template: CMS-driven overlays + optional v0 shell (route shape, experience, recommendations).
ALTER TABLE tours ADD COLUMN IF NOT EXISTS detail_page_v2 JSONB DEFAULT NULL;

COMMENT ON COLUMN tours.detail_page_v2 IS
  'Optional JSON: { "version": 1, "content": { ...partial small-group detail fields }, "templateShell": { "routeShape", "experience", "recommendations" } }. Merged over API-built content in the app.';
