import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

/**
 * POST /api/reviews/upload
 * Upload review photos to Supabase Storage
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const userId = user.id;

    const formData = await req.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    // Limit to 5 photos per review
    if (files.length > 5) {
      return NextResponse.json(
        { error: 'Maximum 5 photos allowed per review' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    const uploadedUrls: string[] = [];

    // Upload each file to Supabase Storage
    for (const file of files) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        return NextResponse.json(
          { error: 'Only image files are allowed' },
          { status: 400 }
        );
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        return NextResponse.json(
          { error: 'File size must be less than 5MB' },
          { status: 400 }
        );
      }

      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `review-photos/${fileName}`;

      // Convert File to ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('review-photos')
        .upload(filePath, buffer, {
          contentType: file.type,
          upsert: false,
        });

      if (error) {
        console.error('Error uploading file:', error);
        return NextResponse.json(
          { error: 'Failed to upload file' },
          { status: 500 }
        );
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('review-photos')
        .getPublicUrl(filePath);

      if (urlData?.publicUrl) {
        uploadedUrls.push(urlData.publicUrl);
      }
    }

    return NextResponse.json({ urls: uploadedUrls });
  } catch (error: any) {
    console.error('Error in upload API:', error);
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

