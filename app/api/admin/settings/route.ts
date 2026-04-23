import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';
import { handleApiError, ErrorResponses } from '@/lib/error-handler';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/settings
 * Get system settings
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const supabase = createServerClient();

    const defaultSettings = {
      siteName: 'AtoC Korea',
      siteDescription: 'Licensed Korea-based tour booking platform',
      maintenanceMode: false,
      allowRegistrations: true,
      contactEmail: 'info@atockorea.com',
      supportEmail: 'support@atockorea.com',
    };

    const { data, error } = await supabase
      .from('site_settings')
      .select('cms_content_overrides')
      .eq('id', 'default')
      .maybeSingle<{ cms_content_overrides?: Record<string, unknown> | null }>();

    if (error) {
      return NextResponse.json({
        success: true,
        data: defaultSettings,
      });
    }

    const overrides = (data?.cms_content_overrides ?? {}) as Record<string, unknown>;
    const adminSettings = (overrides.adminSettings ?? {}) as Record<string, unknown>;
    const settings = {
      ...defaultSettings,
      ...adminSettings,
    };

    return NextResponse.json({
      success: true,
      data: settings,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message.includes('Forbidden')) {
      return ErrorResponses.forbidden('Admin access required');
    }
    return handleApiError(error);
  }
}

/**
 * PUT /api/admin/settings
 * Update system settings
 */
export async function PUT(request: NextRequest) {
  try {
    await requireAdmin(request);
    const supabase = createServerClient();

    const body = await request.json();

    // Validate settings
    const allowedSettings = [
      'siteName',
      'siteDescription',
      'maintenanceMode',
      'allowRegistrations',
      'contactEmail',
      'supportEmail',
    ];

    const updateData: any = {};
    for (const key of allowedSettings) {
      if (body[key] !== undefined) {
        updateData[key] = body[key];
      }
    }

    const { data, error: loadError } = await supabase
      .from('site_settings')
      .select('cms_content_overrides')
      .eq('id', 'default')
      .maybeSingle<{ cms_content_overrides?: Record<string, unknown> | null }>();

    if (loadError) {
      throw loadError;
    }

    const currentOverrides = (data?.cms_content_overrides ?? {}) as Record<string, unknown>;
    const currentAdminSettings = (currentOverrides.adminSettings ?? {}) as Record<string, unknown>;
    const nextOverrides = {
      ...currentOverrides,
      adminSettings: {
        ...currentAdminSettings,
        ...updateData,
      },
    };

    const { error: saveError } = await supabase
      .from('site_settings')
      .upsert(
        {
          id: 'default',
          cms_content_overrides: nextOverrides,
        },
        { onConflict: 'id' }
      );

    if (saveError) {
      throw saveError;
    }

    return NextResponse.json({
      success: true,
      data: updateData,
      message: 'Settings updated successfully',
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message.includes('Forbidden')) {
      return ErrorResponses.forbidden('Admin access required');
    }
    return handleApiError(error);
  }
}










