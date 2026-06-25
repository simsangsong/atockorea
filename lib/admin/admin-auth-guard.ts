/**
 * Pure decision logic for the admin layout's client-side auth guard.
 *
 * The admin layout (`app/admin/layout.tsx`) loads the session, reads the
 * caller's `user_profiles` row, and decides whether to admit them. This helper
 * maps the (profile, profileError) pair to a single decision so the layout's
 * branching is testable and side-effect-free.
 *
 * M-8: the "no profile" case must NOT create a profile. The previous layout
 * INSERTed a `customer` profile inside this read-only guard — a data mutation
 * that re-created profiles a user had deliberately deleted and was pointless
 * (a non-admin is redirected away regardless). Profiles are lazily created by
 * /mypage and the header where it actually belongs.
 */

export interface ProfileLike {
  role?: string | null;
}

export interface ProfileErrorLike {
  code?: string;
  message?: string;
}

export type AdminGuardDecision =
  | { kind: 'ok' }
  /** JWT expired mid-session — sign out and bounce to signin. */
  | { kind: 'jwt_expired' }
  /** No profile row (PGRST116). M-8: do not auto-create — treat as not-authorized. */
  | { kind: 'no_profile' }
  /** Some other profile-lookup error. */
  | { kind: 'query_failed'; message: string }
  /** Profile exists but isn't an admin. */
  | { kind: 'not_admin'; role: string | null };

export function decideAdminGuard(
  profile: ProfileLike | null | undefined,
  profileError: ProfileErrorLike | null | undefined,
): AdminGuardDecision {
  if (profileError) {
    const message = profileError.message ?? '';
    if (message.toLowerCase().includes('jwt expired')) {
      return { kind: 'jwt_expired' };
    }
    if (profileError.code === 'PGRST116') {
      return { kind: 'no_profile' };
    }
    return { kind: 'query_failed', message: message || 'Unknown profile lookup error' };
  }

  if (!profile || profile.role !== 'admin') {
    return { kind: 'not_admin', role: profile?.role ?? null };
  }

  return { kind: 'ok' };
}
