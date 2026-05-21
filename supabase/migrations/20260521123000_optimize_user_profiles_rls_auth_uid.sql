-- Avoid per-row auth.uid() re-evaluation in hot user profile RLS policies.
-- Supabase linter recommends wrapping auth helpers in a scalar subquery.

alter policy "Users can view own profile"
  on public.user_profiles
  using ((select auth.uid()) = id);

alter policy "Users can update own profile"
  on public.user_profiles
  using ((select auth.uid()) = id);

alter policy "Users can insert own profile"
  on public.user_profiles
  with check ((select auth.uid()) = id);
