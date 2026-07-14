-- Covering index for tour_room_invites.created_by FK (advisor: unindexed_foreign_keys),
-- matching the repo-wide pattern from 20260625120000_add_covering_indexes_unindexed_fks.sql.
-- Applied live 2026-07-14 together with the T0.3 apply of 20260714090000/091000.
CREATE INDEX IF NOT EXISTS idx_tour_room_invites_created_by
  ON public.tour_room_invites(created_by)
  WHERE created_by IS NOT NULL;
