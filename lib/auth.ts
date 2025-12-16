import { createServerClient } from './supabase';
import { NextRequest } from 'next/server';

export type UserRole = 'customer' | 'merchant' | 'admin';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  merchantId?: string;
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
      
      // Debug: Log all cookies
      console.log('🔍 [getAuthUser] All cookies:', Array.from(cookies.entries()).map(([k, v]) => `${k}: ${v.value?.substring(0, 50)}...`));
      
      // Try to find Supabase auth token in cookies
      // Supabase stores session in cookies with pattern: sb-<project-ref>-auth-token
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
      
      console.log('🔍 [getAuthUser] Project ref:', projectRef);
      
      if (projectRef) {
        // Try different cookie name patterns
        const cookieNames = [
          `sb-${projectRef}-auth-token`,
          `sb-${projectRef}-auth-token-code-verifier`,
          `sb-${projectRef}-auth-token.0`,
          `sb-${projectRef}-auth-token.1`,
        ];
        
        console.log('🔍 [getAuthUser] Looking for cookies:', cookieNames);
        
        // Collect all matching cookies (may be split into multiple parts)
        const matchingCookies: Array<{ name: string; value: string }> = [];
        for (const cookieName of cookieNames) {
          const cookie = cookies.get(cookieName);
          if (cookie) {
            console.log(`✅ [getAuthUser] Found cookie: ${cookieName} (length: ${cookie.value.length})`);
            matchingCookies.push({ name: cookieName, value: cookie.value });
          }
        }
        
        // Try to combine split cookies or parse individually
        if (matchingCookies.length > 0) {
          // Sort by name to ensure correct order for split cookies
          matchingCookies.sort((a, b) => a.name.localeCompare(b.name));
          
          // Try combined value first (for split cookies like .0, .1, etc.)
          const combinedValue = matchingCookies.map(c => c.value).join('');
          console.log(`🔍 [getAuthUser] Combined cookie value length: ${combinedValue.length}`);
          
          try {
            const sessionData = JSON.parse(combinedValue);
            console.log('🔍 [getAuthUser] Parsed session data keys:', Object.keys(sessionData));
            const accessToken = sessionData?.access_token || sessionData?.accessToken || sessionData?.session?.access_token;
            
            console.log('🔍 [getAuthUser] Parsed combined session data, has access_token:', !!accessToken);
            
            if (accessToken) {
              const { data: { user: authUser }, error } = await supabase.auth.getUser(accessToken);
              if (!error && authUser) {
                console.log('✅ [getAuthUser] User authenticated from combined cookie:', authUser.id);
                user = authUser;
              } else {
                console.error('❌ [getAuthUser] Error getting user from combined token:', error);
              }
            } else {
              console.warn('⚠️ [getAuthUser] No access_token found in session data. Structure:', JSON.stringify(sessionData).substring(0, 500));
            }
          } catch (e: any) {
            console.warn('⚠️ [getAuthUser] Combined cookie parse error:', e.message);
            console.warn('⚠️ [getAuthUser] Cookie value (first 500 chars):', combinedValue.substring(0, 500));
            
            // Try each cookie individually
            for (const cookie of matchingCookies) {
              try {
                const sessionData = JSON.parse(cookie.value);
                const accessToken = sessionData?.access_token || sessionData?.accessToken;
                
                if (accessToken) {
                  const { data: { user: authUser }, error } = await supabase.auth.getUser(accessToken);
                  if (!error && authUser) {
                    console.log('✅ [getAuthUser] User authenticated from individual cookie:', authUser.id);
                    user = authUser;
                    break;
                  }
                }
              } catch (e2) {
                // Not JSON, try as direct token
                try {
                  const { data: { user: authUser }, error } = await supabase.auth.getUser(cookie.value);
                  if (!error && authUser) {
                    console.log('✅ [getAuthUser] User authenticated from direct token');
                    user = authUser;
                    break;
                  }
                } catch (e3) {
                  // Skip this cookie
                }
              }
            }
          }
        }
      }
      
      // Fallback: Try to get session from all cookies by looking for access_token
      if (!user) {
        console.log('🔍 [getAuthUser] Trying fallback: checking all cookies for auth/token');
        for (const [name, cookie] of cookies.entries()) {
          if (name.includes('auth') || name.includes('token')) {
            console.log(`🔍 [getAuthUser] Checking cookie: ${name}`);
            try {
              const parsed = JSON.parse(cookie.value);
              const accessToken = parsed?.access_token || parsed?.accessToken;
              if (accessToken) {
                const { data: { user: authUser }, error } = await supabase.auth.getUser(accessToken);
                if (!error && authUser) {
                  console.log('✅ [getAuthUser] User authenticated from fallback cookie');
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
      
      if (!user) {
        console.error('❌ [getAuthUser] No user found from cookies');
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
    console.error('Auth error:', error);
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
    console.error('Auth error:', error);
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
 * Require admin role
 */
export async function requireAdmin(req: NextRequest): Promise<AuthUser> {
  return requireRole(req, ['admin']);
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

