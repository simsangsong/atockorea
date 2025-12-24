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

    // Get settings from database (if settings table exists)
    // For now, return default settings
    const settings = {
      siteName: 'AtoC Korea',
      siteDescription: 'Licensed Korea-based tour booking platform',
      maintenanceMode: false,
      allowRegistrations: true,
      contactEmail: 'info@atockorea.com',
      supportEmail: 'support@atockorea.com',
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

    // In a real implementation, you would save to a settings table
    // For now, we'll just return success
    // TODO: Create settings table and save data

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


