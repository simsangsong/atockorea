import { cookies } from 'next/headers';
import { createServerClient, createSupabaseServerComponentClient } from './supabase';
import { NextRequest, NextResponse } from 'next/server';

export type UserRole = 'customer' | 'merchant' | 'admin';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  merchantId?: string;
}

/** Thrown by `requireAdmin` when admin routes should return JSON error bodies (see `adminAuthJsonResponse`). */
export class AdminAuthFailure extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, message: string, code = 'AUTH') {
    super(message);
    this.name = 'AdminAuthFailure';
    this.status = status;
    this.code = code;
  }
}

export function adminAuthJsonResponse(e: AdminAuthFailure): NextResponse {
  return NextResponse.json({ ok: false, code: e.code, message: e.message }, { status: e.status });
}

/**
 * Get current authenticated user from request.
 *
 * Supports both:
 *   1. `Authorization: Bearer <jwt>` header — for API clients passing a
 *      token explicitly (mobile, server-to-server, automation).
 *   2. Supabase session cookies — for browser requests. After
 *      adopting `@supabase/ssr` (PR #84) the cookie reading is handled by
 *      the SSR helper instead of a hand-rolled chunk parser, which
 *      removed ~125 lines of cookie wrangling that existed because the
 *      browser used to store the session in localStorage.
 */
export type GetAuthUserOptions = {
  /**
   * Skip the `user_profiles` role (+`merchants`) lookup and return
   * `role: 'customer'` as a placeholder. For identity-only endpoints
   * (mypage summary/extras) the lookup added 1–2 DB round trips per request
   * that the handler never read. NEVER set this on a route that authorizes
   * by role — use the default (full) lookup or requireAdmin instead.
   */
  skipRoleLookup?: boolean;
};

export async function getAuthUser(
  req: NextRequest,
  options?: GetAuthUserOptions,
): Promise<AuthUser | null> {
  try {
    const adminSupabase = createServerClient(); // service-role: profile/merchant lookups
    let user: { id: string; email?: string | null } | null = null;

    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data, error } = await adminSupabase.auth.getUser(token);
      if (!error && data?.user) user = data.user;
    }

    if (!user) {
      try {
        const cookieStore = await cookies();
        const ssrSupabase = createSupabaseServerComponentClient({
          getAll: () => cookieStore.getAll(),
          set: (name, value, options) => {
            try { cookieStore.set(name, value, options); } catch { /* response cookies not writable in this context */ }
          },
        });
        const { data } = await ssrSupabase.auth.getUser();
        if (data?.user) user = data.user;
      } catch (e) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[getAuthUser] ssr cookie read failed:', (e as Error)?.message);
        }
      }
    }

    if (!user) return null;

    if (options?.skipRoleLookup) {
      return {
        id: user.id,
        email: user.email || '',
        role: 'customer',
      };
    }

    const { data: profile } = await adminSupabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    let merchantId: string | undefined;
    if (profile?.role === 'merchant') {
      const { data: merchant } = await adminSupabase
        .from('merchants')
        .select('id')
        .eq('user_id', user.id)
        .single();
      merchantId = merchant?.id;
    }

    return {
      id: user.id,
      email: user.email || '',
      role: (profile?.role as UserRole) || 'customer',
      merchantId,
    };
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[getAuthUser] Error:', error);
    }
    return null;
  }
}

/**
 * Get auth user from session token (for client-side)
 */
export async function getAuthUserFromToken(token: string): Promise<AuthUser | null> {
  try {
    const supabase = createServerClient();
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return null;
    }
    
    // Get user profile with role
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    
    // Get merchant_id if user is a merchant
    let merchantId: string | undefined;
    if (profile?.role === 'merchant') {
      const { data: merchant } = await supabase
        .from('merchants')
        .select('id')
        .eq('user_id', user.id)
        .single();
      merchantId = merchant?.id;
    }
    
    return {
      id: user.id,
      email: user.email || '',
      role: (profile?.role as UserRole) || 'customer',
      merchantId,
    };
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[getAuthUserFromToken] Error:', error);
    }
    return null;
  }
}

/**
 * Require authentication - throws error if not authenticated
 */
export async function requireAuth(req: NextRequest): Promise<AuthUser> {
  const user = await getAuthUser(req);
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}

/**
 * Require specific role - throws error if user doesn't have required role
 */
export async function requireRole(
  req: NextRequest,
  roles: UserRole[]
): Promise<AuthUser> {
  const user = await requireAuth(req);
  if (!roles.includes(user.role)) {
    throw new Error('Forbidden: Insufficient permissions');
  }
  return user;
}

/**
 * Require admin role (throws {@link AdminAuthFailure} for consistent JSON error handling on admin APIs).
 */
export async function requireAdmin(req: NextRequest): Promise<AuthUser> {
  const user = await getAuthUser(req);
  if (!user) {
    throw new AdminAuthFailure(401, 'Unauthorized', 'UNAUTHORIZED');
  }
  if (user.role !== 'admin') {
    throw new AdminAuthFailure(403, 'Forbidden: Insufficient permissions', 'FORBIDDEN');
  }
  return user;
}

/**
 * Require merchant role
 */
export async function requireMerchant(req: NextRequest): Promise<AuthUser> {
  return requireRole(req, ['merchant', 'admin']);
}

/**
 * Get merchant ID from authenticated user
 */
export async function getMerchantId(req: NextRequest): Promise<string> {
  const user = await requireMerchant(req);
  if (!user.merchantId) {
    throw new Error('User is not associated with a merchant');
  }
  return user.merchantId;
}

