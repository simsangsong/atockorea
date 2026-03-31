import { compressImageFileForReview } from '@/lib/review-image-client-compress';
import { reviewImageOptions } from '@/lib/file-upload';

const REVIEW_FOLDER = 'reviews';

/**
 * Upload review image(s) via POST /api/upload only (tour-images bucket, path `reviews/{userId}/...`).
 */
export async function uploadReviewImagesThroughApi(
  files: File[],
  accessToken: string,
): Promise<string[]> {
  if (files.length === 0) return [];
  if (reviewImageOptions.maxFiles && files.length > reviewImageOptions.maxFiles) {
    throw new Error(`At most ${reviewImageOptions.maxFiles} images allowed`);
  }

  const prepared: File[] = [];
  for (const f of files) {
    if (!reviewImageOptions.allowedTypes.includes(f.type)) {
      throw new Error(`File type not allowed: ${f.type}`);
    }
    prepared.push(
      f.size > reviewImageOptions.maxSize
        ? await compressImageFileForReview(f)
        : f,
    );
  }

  const formData = new FormData();
  if (prepared.length === 1) {
    formData.append('file', prepared[0]);
  } else {
    prepared.forEach((file) => formData.append('files', file));
  }
  formData.append('type', 'product');
  formData.append('folder', REVIEW_FOLDER);

  const response = await fetch('/api/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    credentials: 'include',
    body: formData,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Upload failed');
  }

  if (data.url) {
    return [data.url as string];
  }
  if (Array.isArray(data.files)) {
    return data.files.map((f: { url: string }) => f.url);
  }
  throw new Error('Unexpected upload response');
}
