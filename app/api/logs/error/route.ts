import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { createServerLogger } from '@/lib/logger';

/**
 * POST /api/logs/error
 * Log client-side errors to server
 */
export async function POST(req: NextRequest) {
  try {
    const logger = createServerLogger(req);
    const body = await req.json();

    const { level, message, error, context } = body;

    // Log to server console
    logger.error(`Client error: ${message}`, error ? new Error(error.message) : undefined, {
      level,
      clientContext: context,
      errorDetails: error,
    });

    // Optionally save to database for error tracking
    // Uncomment if you want to persist errors to database
    /*
    const supabase = createServerClient();
    await supabase.from('error_logs').insert({
      level,
      message,
      error_name: error?.name,
      error_message: error?.message,
      error_stack: error?.stack,
      context: context || {},
      user_id: context?.userId,
      url: context?.url,
      user_agent: context?.userAgent,
    });
    */

    return NextResponse.json({ success: true });
  } catch (error: any) {
    // Don't fail if error logging fails
    console.error('Failed to log error:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}








