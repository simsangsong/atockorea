import type { SupabaseClient } from '@supabase/supabase-js';

export type MerchantProfileSummary = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url?: string | null;
};

export async function getMerchantProfileMap(
  supabase: SupabaseClient,
  userIds: Array<string | null | undefined>,
  options: { includeAvatar?: boolean } = {},
) {
  const ids = Array.from(new Set(userIds.filter((id): id is string => Boolean(id))));
  const profiles = new Map<string, MerchantProfileSummary>();

  if (ids.length === 0) {
    return profiles;
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, full_name, email, avatar_url')
    .in('id', ids);

  if (error) {
    throw error;
  }

  for (const profile of data || []) {
    profiles.set(profile.id, profile as MerchantProfileSummary);
  }

  return profiles;
}
