/**
 * Browser-only: resize/compress images toward the review 2MB target before POST /api/upload.
 * Uses canvas + JPEG quality iteration (no direct storage upload).
 */

import { REVIEW_IMAGE_MAX_BYTES } from '@/lib/file-upload';

const ALLOWED = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}

function canvasToJpegBlob(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to encode image'));
      },
      'image/jpeg',
      quality,
    );
  });
}

/**
 * Compress image file to be at most `maxBytes` (default review 2MB), output as JPEG.
 */
export async function compressImageFileForReview(
  file: File,
  maxBytes: number = REVIEW_IMAGE_MAX_BYTES,
): Promise<File> {
  if (!ALLOWED.includes(file.type)) {
    throw new Error(`Unsupported image type: ${file.type}`);
  }

  if (file.size <= maxBytes) {
    return file;
  }

  const img = await loadImage(file);
  const maxEdge = 1920;
  let w = img.naturalWidth;
  let h = img.naturalHeight;
  if (w > maxEdge || h > maxEdge) {
    const scale = Math.min(maxEdge / w, maxEdge / h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.drawImage(img, 0, 0, w, h);

  let quality = 0.85;
  let blob = await canvasToJpegBlob(canvas, quality);
  let attempts = 0;
  const maxAttempts = 12;

  while (blob.size > maxBytes && attempts < maxAttempts) {
    attempts++;
    if (quality > 0.45) {
      quality = Math.max(0.45, quality - 0.07);
    } else if (w > 640 || h > 640) {
      w = Math.max(640, Math.round(w * 0.85));
      h = Math.max(640, Math.round(h * 0.85));
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);
      quality = 0.75;
    } else {
      quality = Math.max(0.35, quality - 0.05);
    }
    blob = await canvasToJpegBlob(canvas, quality);
  }

  if (blob.size > maxBytes) {
    throw new Error(
      `Image is still larger than ${(maxBytes / (1024 * 1024)).toFixed(1)}MB after compression. Try a smaller image.`,
    );
  }

  const name = file.name.replace(/\.[^.]+$/, '') + '-review.jpg';
  return new File([blob], name, { type: 'image/jpeg' });
}
