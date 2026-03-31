import { createServerClient } from './supabase';
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
 * Bearer token or Supabase session cookie `access_token` (for user-scoped Supabase clients).
 */
export function getAccessTokenFromRequest(req: NextRequest): string | null {
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const t = authHeader.slice(7).trim();
    if (t) return t;
  }

  const cookies = req.cookies;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
  if (!projectRef) return null;

  const cookieNames = [
    `sb-${projectRef}-auth-token`,
    `sb-${projectRef}-auth-token.0`,
    `sb-${projectRef}-auth-token.1`,
  ];
  const parts: string[] = [];
  for (const name of cookieNames) {
    const c = cookies.get(name);
    if (c?.value) parts.push(c.value);
  }
  if (parts.length === 0) return null;

  const combined = parts.join('');
  try {
    const sessionData = JSON.parse(combined) as {
      access_token?: string;
      accessToken?: string;
      session?: { access_token?: string };
    };
    const accessToken =
      sessionData?.access_token || sessionData?.accessToken || sessionData?.session?.access_token;
    return typeof accessToken === 'string' && accessToken ? accessToken : null;
  } catch {
    return null;
  }
}

/**
 * Get current authenticated user from request
 * Supports both Authorization header and cookie-based authentication
 */
export async function getAuthUser(req: NextRequest): Promise<AuthUser | null> {
  try {
    const supabase = createServerClient();
    let user: any = null;
    
    // Method 1: Try Authorization header (for API clients)
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data: { user: authUser }, error } = await supabase.auth.getUser(token);
      if (!error && authUser) {
        user = authUser;
      }
    }
    
    // Method 2: Try cookie-based authentication (for browser requests)
    if (!user) {
      // Get all cookies
      const cookies = req.cookies;
      
      // Try to find Supabase auth token in cookies
      // Supabase stores session in cookies with pattern: sb-<project-ref>-auth-token
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
      const isDev = process.env.NODE_ENV === 'development';

      if (projectRef) {
        // Try different cookie name patterns
        const cookieNames = [
          `sb-${projectRef}-auth-token`,
          `sb-${projectRef}-auth-token-code-verifier`,
          `sb-${projectRef}-auth-token.0`,
          `sb-${projectRef}-auth-token.1`,
        ];

        // Collect all matching cookies (may be split into multiple parts)
        const matchingCookies: Array<{ name: string; value: string }> = [];
        for (const cookieName of cookieNames) {
          const cookie = cookies.get(cookieName);
          if (cookie) {
            matchingCookies.push({ name: cookieName, value: cookie.value });
          }
        }

        // Try to combine split cookies or parse individually
        if (matchingCookies.length > 0) {
          // Sort by name to ensure correct order for split cookies
          matchingCookies.sort((a, b) => a.name.localeCompare(b.name));

          // Try combined value first (for split cookies like .0, .1, etc.)
          const combinedValue = matchingCookies.map(c => c.value).join('');

          try {
            const sessionData = JSON.parse(combinedValue);
            const accessToken = sessionData?.access_token || sessionData?.accessToken || sessionData?.session?.access_token;

            if (accessToken) {
              const { data: { user: authUser }, error } = await supabase.auth.getUser(accessToken);
              if (!error && authUser) {
                user = authUser;
              } else if (isDev) {
                console.warn('[getAuthUser] Token validation failed:', error?.message);
              }
            }
          } catch (e: any) {
            if (isDev) {
              console.warn('[getAuthUser] Cookie parse error:', e.message);
            }
            
            // Try each cookie individually
            for (const cookie of matchingCookies) {
              try {
                const sessionData = JSON.parse(cookie.value);
                const accessToken = sessionData?.access_token || sessionData?.accessToken;

                if (accessToken) {
                  const { data: { user: authUser }, error } = await supabase.auth.getUser(accessToken);
                  if (!error && authUser) {
                    user = authUser;
                    break;
                  }
                }
              } catch {
                // Not JSON, try as direct token
                try {
                  const { data: { user: authUser }, error } = await supabase.auth.getUser(cookie.value);
                  if (!error && authUser) {
                    user = authUser;
                    break;
                  }
                } catch {
                  // Skip this cookie
                }
              }
            }
          }
        }
      }

      // Fallback: Try common cookie names for auth tokens
      if (!user && projectRef) {
        const fallbackCookieNames = [
          'sb-auth-token',
          'supabase-auth-token',
          'auth-token',
        ];
        
        for (const cookieName of fallbackCookieNames) {
          const cookie = cookies.get(cookieName);
          if (cookie) {
            try {
              const parsed = JSON.parse(cookie.value);
              const accessToken = parsed?.access_token || parsed?.accessToken;
              if (accessToken) {
                const { data: { user: authUser }, error } = await supabase.auth.getUser(accessToken);
                if (!error && authUser) {
                  user = authUser;
                  break;
                }
              }
            } catch (e) {
              // Not JSON, skip
            }
          }
        }
      }
      
    }
    
    if (!user) {
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

