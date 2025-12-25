/**
 * Image compression and resizing utilities using Sharp
 */

import sharp from 'sharp';

export interface CompressionOptions {
  maxSizeBytes: number; // Target max file size in bytes (e.g., 5MB)
  maxWidth?: number; // Max width in pixels (default: 1920)
  maxHeight?: number; // Max height in pixels (default: 1920)
  quality?: number; // JPEG/WebP quality (1-100, default: 85)
  format?: 'jpeg' | 'webp' | 'png'; // Output format (default: 'jpeg')
}

const DEFAULT_OPTIONS: CompressionOptions = {
  maxSizeBytes: 5 * 1024 * 1024, // 5MB
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 85,
  format: 'jpeg',
};

/**
 * Compress and resize image to meet size requirements
 * Automatically reduces quality and size until target size is met
 */
export async function compressImage(
  inputBuffer: Buffer,
  options: Partial<CompressionOptions> = {}
): Promise<{ buffer: Buffer; format: string; originalSize: number; compressedSize: number }> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const originalSize = inputBuffer.length;

  // If already under size limit, return as-is
  if (originalSize <= opts.maxSizeBytes) {
    return {
      buffer: inputBuffer,
      format: 'original',
      originalSize,
      compressedSize: originalSize,
    };
  }

  // Get image metadata
  const metadata = await sharp(inputBuffer).metadata();
  const inputFormat = metadata.format;

  // Determine output format
  let outputFormat: 'jpeg' | 'webp' | 'png' = opts.format || 'jpeg';
  if (inputFormat === 'png' && opts.format !== 'jpeg') {
    outputFormat = 'png';
  } else if (inputFormat === 'webp' && opts.format !== 'jpeg') {
    outputFormat = 'webp';
  }

  // Calculate target dimensions (maintain aspect ratio)
  let targetWidth = metadata.width || opts.maxWidth!;
  let targetHeight = metadata.height || opts.maxHeight!;

  if (metadata.width && metadata.height) {
    const aspectRatio = metadata.width / metadata.height;
    if (metadata.width > opts.maxWidth!) {
      targetWidth = opts.maxWidth!;
      targetHeight = Math.round(targetWidth / aspectRatio);
    }
    if (targetHeight > opts.maxHeight!) {
      targetHeight = opts.maxHeight!;
      targetWidth = Math.round(targetHeight * aspectRatio);
    }
  }

  // Start with high quality and reduce if needed
  let quality = opts.quality || 85;
  let resultBuffer: Buffer;
  let attempts = 0;
  const maxAttempts = 5;

  do {
    // Create sharp instance with resizing and compression
    let sharpInstance = sharp(inputBuffer)
      .resize(targetWidth, targetHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      });

    // Apply format-specific compression
    if (outputFormat === 'jpeg') {
      sharpInstance = sharpInstance.jpeg({ quality, progressive: true });
    } else if (outputFormat === 'webp') {
      sharpInstance = sharpInstance.webp({ quality });
    } else if (outputFormat === 'png') {
      sharpInstance = sharpInstance.png({ 
        quality: Math.min(quality + 20, 100), // PNG quality is 0-100
        compressionLevel: 9,
      });
    }

    resultBuffer = await sharpInstance.toBuffer();
    attempts++;

    // If still too large, reduce quality or dimensions
    if (resultBuffer.length > opts.maxSizeBytes && attempts < maxAttempts) {
      if (quality > 60) {
        // Reduce quality first
        quality = Math.max(60, quality - 10);
      } else if (targetWidth > 800 || targetHeight > 800) {
        // Then reduce dimensions
        targetWidth = Math.max(800, Math.round(targetWidth * 0.8));
        targetHeight = Math.max(800, Math.round(targetHeight * 0.8));
        quality = 70; // Reset quality when resizing
      } else {
        // Last resort: aggressive compression
        quality = 50;
      }
    }
  } while (resultBuffer.length > opts.maxSizeBytes && attempts < maxAttempts);

  return {
    buffer: resultBuffer,
    format: outputFormat,
    originalSize,
    compressedSize: resultBuffer.length,
  };
}

/**
 * Get MIME type from format
 */
export function getMimeType(format: string): string {
  switch (format.toLowerCase()) {
    case 'jpeg':
    case 'jpg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    default:
      return 'image/jpeg';
  }
}




