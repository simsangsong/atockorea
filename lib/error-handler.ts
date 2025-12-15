import { NextRequest, NextResponse } from 'next/server';
import { logger, createServerLogger } from './logger';

export interface ApiError {
  message: string;
  code?: string;
  statusCode: number;
  details?: any;
}

export class AppError extends Error {
  statusCode: number;
  code?: string;
  details?: any;

  constructor(message: string, statusCode: number = 500, code?: string, details?: any) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Handle API errors and return appropriate response
 */
export function handleApiError(error: unknown, req?: NextRequest): NextResponse {
  const serverLogger = req ? createServerLogger(req) : logger;

  // Known application errors
  if (error instanceof AppError) {
    serverLogger.warn('Application error', {
      code: error.code,
      statusCode: error.statusCode,
      details: error.details,
    });

    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        details: error.details,
      },
      { status: error.statusCode }
    );
  }

  // Supabase errors
  if (error && typeof error === 'object' && 'code' in error) {
    const supabaseError = error as { code: string; message: string; details?: any };
    
    serverLogger.error('Supabase error', undefined, {
      code: supabaseError.code,
      message: supabaseError.message,
      details: supabaseError.details,
    });

    // Map common Supabase error codes to HTTP status codes
    const statusCode = mapSupabaseErrorCode(supabaseError.code);

    return NextResponse.json(
      {
        error: supabaseError.message || 'Database error',
        code: supabaseError.code,
        details: supabaseError.details,
      },
      { status: statusCode }
    );
  }

  // Generic errors
  const errorMessage = error instanceof Error ? error.message : 'Internal server error';
  const errorStack = error instanceof Error ? error.stack : undefined;

  serverLogger.error('Unexpected error', error instanceof Error ? error : new Error(String(error)), {
    message: errorMessage,
  });

  // Don't expose stack traces in production
  const isDevelopment = process.env.NODE_ENV === 'development';

  return NextResponse.json(
    {
      error: isDevelopment ? errorMessage : 'Internal server error',
      ...(isDevelopment && errorStack ? { stack: errorStack } : {}),
    },
    { status: 500 }
  );
}

/**
 * Map Supabase error codes to HTTP status codes
 */
function mapSupabaseErrorCode(code: string): number {
  const codeMap: Record<string, number> = {
    '23505': 409, // Unique violation
    '23503': 400, // Foreign key violation
    '23502': 400, // Not null violation
    'PGRST116': 404, // Not found
    'PGRST301': 401, // Unauthorized
    '42501': 403, // Insufficient privilege
  };

  return codeMap[code] || 500;
}

/**
 * Wrapper for API route handlers with error handling
 */
export function withErrorHandler<T extends any[]>(
  handler: (req: NextRequest, ...args: T) => Promise<NextResponse>
) {
  return async (req: NextRequest, ...args: T): Promise<NextResponse> => {
    try {
      return await handler(req, ...args);
    } catch (error) {
      return handleApiError(error, req);
    }
  };
}

/**
 * Create standardized error responses
 */
export function createErrorResponse(
  message: string,
  statusCode: number = 500,
  code?: string,
  details?: any
): NextResponse {
  return NextResponse.json(
    {
      error: message,
      code,
      details,
      timestamp: new Date().toISOString(),
    },
    { status: statusCode }
  );
}

/**
 * Create standardized success responses
 */
export function createSuccessResponse(
  data: any,
  statusCode: number = 200,
  message?: string
): NextResponse {
  return NextResponse.json(
    {
      data,
      message,
      success: true,
      timestamp: new Date().toISOString(),
    },
    { status: statusCode }
  );
}

/**
 * Common error codes
 */
export const ErrorCodes = {
  // Authentication & Authorization
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_TOKEN: 'INVALID_TOKEN',
  
  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  MISSING_FIELD: 'MISSING_FIELD',
  INVALID_INPUT: 'INVALID_INPUT',
  
  // Resources
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  CONFLICT: 'CONFLICT',
  
  // Payment
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  PAYMENT_PROCESSING: 'PAYMENT_PROCESSING',
  
  // Booking
  BOOKING_UNAVAILABLE: 'BOOKING_UNAVAILABLE',
  BOOKING_EXPIRED: 'BOOKING_EXPIRED',
  
  // System
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
} as const;

/**
 * Helper functions for common error responses
 */
export const ErrorResponses = {
  unauthorized: (message: string = 'Unauthorized') =>
    createErrorResponse(message, 401, ErrorCodes.UNAUTHORIZED),
  
  forbidden: (message: string = 'Forbidden') =>
    createErrorResponse(message, 403, ErrorCodes.FORBIDDEN),
  
  notFound: (resource: string = 'Resource') =>
    createErrorResponse(`${resource} not found`, 404, ErrorCodes.NOT_FOUND),
  
  validationError: (message: string, details?: any) =>
    createErrorResponse(message, 400, ErrorCodes.VALIDATION_ERROR, details),
  
  conflict: (message: string) =>
    createErrorResponse(message, 409, ErrorCodes.CONFLICT),
  
  internalError: (message: string = 'Internal server error', details?: any) =>
    createErrorResponse(message, 500, ErrorCodes.INTERNAL_ERROR, details),
  
  serviceUnavailable: (message: string = 'Service temporarily unavailable') =>
    createErrorResponse(message, 503, ErrorCodes.SERVICE_UNAVAILABLE),
  
  rateLimitExceeded: (message: string = 'Too many requests') =>
    createErrorResponse(message, 429, ErrorCodes.RATE_LIMIT_EXCEEDED),
};

