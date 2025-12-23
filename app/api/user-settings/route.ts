import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

// Force dynamic rendering for API routes that use headers
export const dynamic = 'force-dynamic';

/**
 * GET /api/user-settings
 * Get user settings
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = createServerClient();
    
    // Get user from auth
    const authHeader = req.headers.get('authorization');
    let userId: string | null = null;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (!authError && user) {
        userId = user.id;
      }
    }

    // Fallback: get from query params
    if (!userId) {
      const { searchParams } = new URL(req.url);
      userId = searchParams.get('userId');
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required or userId parameter required' },
        { status: 401 }
      );
    }

    const { data: settings, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Settings don't exist, return defaults
        return NextResponse.json({
          settings: {
            user_id: userId,
            language: 'en',
            currency: 'USD',
            email_notifications: true,
            sms_notifications: false,
            marketing_emails: false,
          },
        });
      }
      console.error('Error fetching user settings:', error);
      return NextResponse.json(
        { error: 'Failed to fetch user settings', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ settings });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/user-settings
 * Update user settings
 */
export async function PUT(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const body = await req.json();

    // Get user from auth
    const authHeader = req.headers.get('authorization');
    let userId: string | null = null;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (!authError && user) {
        userId = user.id;
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const {
      language,
      currency,
      emailNotifications,
      smsNotifications,
      marketingEmails,
    } = body;

    // Check if settings exist
    const { data: existing } = await supabase
      .from('user_settings')
      .select('id')
      .eq('user_id', userId)
      .single();

    const settingsData: any = {
      user_id: userId,
    };

    if (language !== undefined) settingsData.language = language;
    if (currency !== undefined) settingsData.currency = currency;
    if (emailNotifications !== undefined) settingsData.email_notifications = emailNotifications;
    if (smsNotifications !== undefined) settingsData.sms_notifications = smsNotifications;
    if (marketingEmails !== undefined) settingsData.marketing_emails = marketingEmails;

    let settings;
    let error;

    if (existing) {
      // Update existing
      const result = await supabase
        .from('user_settings')
        .update(settingsData)
        .eq('id', existing.id)
        .select()
        .single();
      settings = result.data;
      error = result.error;
    } else {
      // Create new
      const result = await supabase
        .from('user_settings')
        .insert(settingsData)
        .select()
        .single();
      settings = result.data;
      error = result.error;
    }

    if (error) {
      console.error('Error updating user settings:', error);
      return NextResponse.json(
        { error: 'Failed to update user settings', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ settings, message: 'Settings updated successfully' });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}




