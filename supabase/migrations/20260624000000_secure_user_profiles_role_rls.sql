-- W0.1 (P1) — Block privilege escalation via user_profiles.role
--
-- LIVE-CONFIRMED VULNERABILITY: the "Users can update own profile" UPDATE policy
-- had NO WITH CHECK and the role CHECK constraint allows 'admin', so any
-- authenticated customer could call PostgREST directly:
--   PATCH /rest/v1/user_profiles?id=eq.<own-uid>  {"role":"admin"}
-- and self-promote to admin, fully bypassing the Next.js layer. The INSERT
-- policy likewise did not guard role (self-insert as admin/merchant).
--
-- FIX: pin role on end-user writes. The service_role (used by all legitimate
-- role-change paths: /api/admin/merchants*, create-profile) bypasses RLS and is
-- unaffected. All user-session inserts in the app write role='customer'.
--
-- A self-referencing subquery in the UPDATE policy triggers Postgres
-- "infinite recursion detected in policy", so the current role is read through a
-- SECURITY DEFINER helper (bypasses RLS, returns the OLD committed value during
-- an UPDATE). The helper lives in a non-`public` schema so PostgREST never
-- exposes it as an RPC (no new /rest/v1/rpc attack surface) — it only ever
-- returns the caller's own role.
--
-- Idempotent: CREATE [SCHEMA|OR REPLACE] + DROP IF EXISTS, atomic in the txn.

CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.current_profile_role()
  RETURNS text
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
  SELECT role FROM public.user_profiles WHERE id = (SELECT auth.uid())
$$;

REVOKE EXECUTE ON FUNCTION private.current_profile_role() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION private.current_profile_role() TO authenticated, service_role;

-- UPDATE: role is immutable for end-user sessions. Other fields (name, phone,
-- language_preference, mypage_preferences, avatar_url) remain editable.
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
CREATE POLICY "Users can update own profile"
  ON public.user_profiles
  FOR UPDATE
  USING ((SELECT auth.uid()) = id)
  WITH CHECK (
    (SELECT auth.uid()) = id
    AND role IS NOT DISTINCT FROM private.current_profile_role()
  );

-- INSERT: self-insert only as the default 'customer' role (or NULL → defaults to
-- 'customer'). Blocks self-insert as 'admin'/'merchant'.
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
CREATE POLICY "Users can insert own profile"
  ON public.user_profiles
  FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) = id
    AND (role IS NULL OR role = 'customer')
  );

-- Drop the earlier public-schema helper (superseded by private schema variant).
DROP FUNCTION IF EXISTS public.current_profile_role();
