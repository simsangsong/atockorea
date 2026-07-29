/**
 * SG-4d — meeting-point photo constants shared by the capture route, the
 * review queue, and the snapshot's guest-facing map. PUBLIC bucket on
 * purpose: meeting points are not PII, and signed URLs churn out of the
 * tour-room service worker's image cache (the same reason X17's share is
 * text — recorded in lib/tour-room/timelineShare.ts).
 */
export const MEETING_PHOTO_BUCKET = 'tour-meeting-points';

export function meetingPhotoPublicUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
  return `${base}/storage/v1/object/public/${MEETING_PHOTO_BUCKET}/${path}`;
}
