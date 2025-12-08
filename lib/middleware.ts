import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, requireRole, UserRole } from './auth';

/**
 * Middleware to verify authentication and role
 */
export function withAuth(
  handler: (req: NextRequest, user: any) => Promise<NextResponse>,
  roles?: UserRole[]
) {
  return async (req: NextRequest) => {
    try {
      let user;
      if (roles) {
        user = await requireRole(req, roles);
      } else {
        user = await getAuthUser(req);
        if (!user) {
          return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 401 }
          );
        }
      }
      return handler(req, user);
    } catch (error: any) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
      if (error.message.includes('Forbidden')) {
        return NextResponse.json(
          { error: 'Forbidden: Insufficient permissions' },
          { status: 403 }
        );
      }
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

/**
 * Middleware to automatically inject merchant_id into queries
 */
export function withMerchantIsolation(
  handler: (req: NextRequest, user: any, merchantId: string) => Promise<NextResponse>
) {
  return withAuth(async (req, user) => {
    if (user.role !== 'merchant' && user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Merchant access required' },
        { status: 403 }
      );
    }
    
    // Admins can access all data (no isolation)
    if (user.role === 'admin') {
      return handler(req, user, '');
    }
    
    // Merchants can only access their own data
    if (!user.merchantId) {
      return NextResponse.json(
        { error: 'User is not associated with a merchant' },
        { status: 403 }
      );
    }
    
    return handler(req, user, user.merchantId);
  }, ['merchant', 'admin']);
}

