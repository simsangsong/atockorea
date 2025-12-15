import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { validateFile, validateFiles, productImageOptions, galleryImageOptions } from '@/lib/file-upload';
import { getAuthUser } from '@/lib/auth';

/**
 * POST /api/upload
 * Upload image(s) to Supabase Storage
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient();
    
    // Get authenticated user (optional for some uploads, required for others)
    let userId: string | null = null;
    try {
      const user = await getAuthUser(req);
      userId = user?.id || null;
    } catch (error) {
      // Authentication optional for uploads, but recommended
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const files = formData.getAll('files') as File[];
    const type = formData.get('type') as string || 'product'; // 'product' or 'gallery'
    const folder = formData.get('folder') as string || 'uploads'; // Optional folder path

    // Determine upload options based on type
    const uploadOptions = type === 'gallery' ? galleryImageOptions : productImageOptions;
    const bucketName = type === 'gallery' ? 'tour-gallery' : 'tour-images';

    // Validate files
    if (file) {
      // Single file upload
      const validation = validateFile(file, uploadOptions);
      if (!validation.valid) {
        return NextResponse.json(
          { error: validation.error },
          { status: 400 }
        );
      }

      // Upload single file
      const result = await uploadFile(supabase, file, bucketName, folder, userId);
      return NextResponse.json(result);
    } else if (files.length > 0) {
      // Multiple files upload
      const validation = validateFiles(files, uploadOptions);
      if (!validation.valid) {
        return NextResponse.json(
          { error: validation.error },
          { status: 400 }
        );
      }

      // Upload all files
      const uploadPromises = files.map((file) =>
        uploadFile(supabase, file, bucketName, folder, userId)
      );
      const results = await Promise.all(uploadPromises);

      return NextResponse.json({
        files: results,
        count: results.length,
      });
    } else {
      return NextResponse.json(
        { error: 'No file provided. Use "file" for single upload or "files" for multiple uploads.' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Upload a single file to Supabase Storage
 */
async function uploadFile(
  supabase: any,
  file: File,
  bucketName: string,
  folder: string,
  userId: string | null
): Promise<{ url: string; path: string; name: string }> {
  // Generate unique filename
  const fileExt = file.name.split('.').pop();
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 15);
  const fileName = `${timestamp}-${randomString}.${fileExt}`;
  const filePath = userId ? `${folder}/${userId}/${fileName}` : `${folder}/${fileName}`;

  // Convert File to ArrayBuffer
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from(bucketName)
    .upload(filePath, buffer, {
      contentType: file.type,
      upsert: false, // Don't overwrite existing files
    });

  if (error) {
    // Check if bucket exists, if not, return helpful error
    if (error.message.includes('Bucket not found')) {
      throw new Error(
        `Storage bucket "${bucketName}" not found. Please create it in Supabase Dashboard → Storage.`
      );
    }
    throw error;
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(bucketName)
    .getPublicUrl(filePath);

  return {
    url: urlData.publicUrl,
    path: filePath,
    name: file.name,
  };
}

/**
 * DELETE /api/upload
 * Delete uploaded file from Supabase Storage
 */
export async function DELETE(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(req.url);
    const path = searchParams.get('path');
    const bucket = searchParams.get('bucket') || 'tour-images';

    if (!path) {
      return NextResponse.json(
        { error: 'Path parameter is required' },
        { status: 400 }
      );
    }

    // Get authenticated user
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Delete file
    const { error } = await supabase.storage
      .from(bucket)
      .remove([path]);

    if (error) {
      console.error('Delete error:', error);
      return NextResponse.json(
        { error: 'Failed to delete file', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'File deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete file', details: error.message },
      { status: 500 }
    );
  }
}

