import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { validateFile, validateFiles, productImageOptions, galleryImageOptions } from '@/lib/file-upload';
import { getAuthUser } from '@/lib/auth';

// Ensure Node.js runtime for sharp
export const runtime = 'nodejs';

// Dynamic import for image compression to handle potential import errors
async function compressImageIfNeeded(buffer: Buffer, maxSizeBytes: number): Promise<{ buffer: Buffer; contentType: string; fileExt: string; wasCompressed: boolean; originalSize: number }> {
  const originalSize = buffer.length;
  
  // If already under size limit, return as-is
  if (buffer.length <= maxSizeBytes) {
    return {
      buffer,
      contentType: 'image/jpeg',
      fileExt: 'jpg',
      wasCompressed: false,
      originalSize,
    };
  }

  try {
    // Dynamically import compressImage to handle potential errors
    const { compressImage, getMimeType } = await import('@/lib/image-compress');
    
    const compressionResult = await compressImage(buffer, {
      maxSizeBytes,
      maxWidth: 1920,
      maxHeight: 1920,
      quality: 85,
      format: 'jpeg',
    });

    const contentType = getMimeType(compressionResult.format);
    const fileExt = compressionResult.format === 'webp' ? 'webp' : 'jpg';

    console.log(`Image compressed: ${(originalSize / 1024 / 1024).toFixed(2)}MB → ${(compressionResult.compressedSize / 1024 / 1024).toFixed(2)}MB`);

    return {
      buffer: compressionResult.buffer,
      contentType,
      fileExt,
      wasCompressed: true,
      originalSize,
    };
  } catch (error: any) {
    console.error('Image compression failed:', error);
    console.error('Error details:', error.message, error.stack);
    // Return original buffer if compression fails
    return {
      buffer,
      contentType: 'image/jpeg',
      fileExt: 'jpg',
      wasCompressed: false,
      originalSize,
    };
  }
}

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

    // Validate files (size check is now handled in uploadFile with auto-compression)
    if (file) {
      // Single file upload
      // Check file type only (size will be handled by auto-compression)
      if (!uploadOptions.allowedTypes.includes(file.type)) {
        return NextResponse.json(
          { error: `File type not allowed. Allowed types: ${uploadOptions.allowedTypes.join(', ')}` },
          { status: 400 }
        );
      }

      // Upload single file (auto-compression will handle size)
      const result = await uploadFile(supabase, file, bucketName, folder, userId);
      return NextResponse.json(result);
    } else if (files.length > 0) {
      // Multiple files upload
      // Check file types and count only (size will be handled by auto-compression)
      if (uploadOptions.maxFiles && files.length > uploadOptions.maxFiles) {
        return NextResponse.json(
          { error: `Maximum ${uploadOptions.maxFiles} files allowed` },
          { status: 400 }
        );
      }

      // Check file types
      for (const file of files) {
        if (!uploadOptions.allowedTypes.includes(file.type)) {
          return NextResponse.json(
            { error: `File type not allowed. Allowed types: ${uploadOptions.allowedTypes.join(', ')}` },
            { status: 400 }
          );
        }
      }

      // Upload all files (auto-compression will handle size)
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
 * Automatically compresses images if they exceed 5MB
 */
async function uploadFile(
  supabase: any,
  file: File,
  bucketName: string,
  folder: string,
  userId: string | null
): Promise<{ url: string; path: string; name: string; originalSize?: number; compressedSize?: number; wasCompressed?: boolean }> {
  // Convert File to ArrayBuffer
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  // Check if it's an image
  const isImage = file.type.startsWith('image/');
  const maxSizeBytes = 5 * 1024 * 1024; // 5MB
  let finalBuffer = buffer;
  let contentType = file.type;
  let fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  let wasCompressed = false;
  let originalSize = buffer.length;
  let compressedSize = buffer.length;

  // Compress image if it exceeds 5MB
  if (isImage && buffer.length > maxSizeBytes) {
    const compressionResult = await compressImageIfNeeded(buffer, maxSizeBytes);
    finalBuffer = compressionResult.buffer;
    contentType = compressionResult.contentType;
    fileExt = compressionResult.fileExt;
    wasCompressed = compressionResult.wasCompressed;
    compressedSize = compressionResult.buffer.length;
  }

  // Generate unique filename
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 15);
  const fileName = `${timestamp}-${randomString}.${fileExt}`;
  const filePath = userId ? `${folder}/${userId}/${fileName}` : `${folder}/${fileName}`;

  // Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from(bucketName)
    .upload(filePath, finalBuffer, {
      contentType,
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
    ...(wasCompressed && {
      originalSize,
      compressedSize,
      wasCompressed: true,
    }),
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





