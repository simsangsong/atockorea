/**
 * Authorization rules for DELETE /api/upload (PA-2 / N17).
 *
 * The upload endpoint writes objects with the layout `${folder}/${userId}/${file}`
 * (and review images at `reviews/${userId}/...`). The DELETE handler runs with a
 * service-role client, so without an ownership check any authenticated user could
 * remove arbitrary objects in arbitrary buckets (IDOR). These helpers constrain
 * deletes to (a) a known set of upload buckets and (b) the caller's own
 * namespace — with admins allowed to manage shared tour assets.
 */

/** Buckets the public upload endpoint is permitted to write/delete. */
export const UPLOAD_DELETE_BUCKETS = ['tour-images', 'tour-gallery'] as const;

export function isAllowedUploadBucket(bucket: string): boolean {
  return (UPLOAD_DELETE_BUCKETS as readonly string[]).includes(bucket);
}

/**
 * Ownership rule for deleting an uploaded object.
 *
 * - Admins may delete any object (tour images/galleries are shared, admin-managed
 *   assets that may have been uploaded under a different admin's id).
 * - Other authenticated users may only delete objects that live under their own
 *   `/{userId}/` path segment.
 * - Paths containing `..` segments are rejected outright (defense-in-depth).
 */
export function canDeleteUploadObject(opts: {
  path: string;
  userId: string;
  role: string;
}): boolean {
  const { path, userId, role } = opts;
  if (!path) return false;

  const segments = path.split('/').filter(Boolean);
  if (segments.includes('..')) return false;

  if (role === 'admin') return true;
  if (!userId) return false;

  return segments.includes(userId);
}
