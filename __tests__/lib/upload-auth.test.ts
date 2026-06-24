import {
  UPLOAD_DELETE_BUCKETS,
  isAllowedUploadBucket,
  canDeleteUploadObject,
} from '@/lib/upload-auth';

describe('isAllowedUploadBucket', () => {
  it('allows the known upload buckets', () => {
    for (const b of UPLOAD_DELETE_BUCKETS) {
      expect(isAllowedUploadBucket(b)).toBe(true);
    }
  });

  it('rejects arbitrary / unrelated buckets', () => {
    expect(isAllowedUploadBucket('avatars')).toBe(false);
    expect(isAllowedUploadBucket('storage')).toBe(false);
    expect(isAllowedUploadBucket('')).toBe(false);
    expect(isAllowedUploadBucket('TOUR-IMAGES')).toBe(false); // case-sensitive
  });
});

describe('canDeleteUploadObject', () => {
  const OWNER = 'user-aaa';
  const OTHER = 'user-bbb';

  it('lets a user delete an object under their own namespace', () => {
    expect(
      canDeleteUploadObject({ path: `uploads/${OWNER}/123-x.jpg`, userId: OWNER, role: 'customer' }),
    ).toBe(true);
    expect(
      canDeleteUploadObject({ path: `reviews/${OWNER}/photo.webp`, userId: OWNER, role: 'customer' }),
    ).toBe(true);
  });

  it("forbids a user from deleting another user's object (PA-2 IDOR regression)", () => {
    expect(
      canDeleteUploadObject({ path: `uploads/${OTHER}/123-x.jpg`, userId: OWNER, role: 'customer' }),
    ).toBe(false);
    expect(
      canDeleteUploadObject({ path: `reviews/${OTHER}/photo.webp`, userId: OWNER, role: 'merchant' }),
    ).toBe(false);
  });

  it('forbids deleting a legacy object with no user segment', () => {
    expect(
      canDeleteUploadObject({ path: 'uploads/123-x.jpg', userId: OWNER, role: 'customer' }),
    ).toBe(false);
  });

  it('lets admins delete any object (shared tour assets)', () => {
    expect(
      canDeleteUploadObject({ path: `uploads/${OTHER}/123-x.jpg`, userId: 'admin-id', role: 'admin' }),
    ).toBe(true);
    expect(
      canDeleteUploadObject({ path: 'uploads/legacy.jpg', userId: 'admin-id', role: 'admin' }),
    ).toBe(true);
  });

  it('rejects path-traversal segments even for the owner', () => {
    expect(
      canDeleteUploadObject({ path: `reviews/${OWNER}/../../${OTHER}/x.jpg`, userId: OWNER, role: 'customer' }),
    ).toBe(false);
  });

  it('rejects path-traversal segments even for admins', () => {
    expect(
      canDeleteUploadObject({ path: 'uploads/../secret.jpg', userId: 'admin-id', role: 'admin' }),
    ).toBe(false);
  });

  it('forbids an empty path', () => {
    expect(canDeleteUploadObject({ path: '', userId: OWNER, role: 'customer' })).toBe(false);
  });

  it('does not match a userId that only appears as a filename substring', () => {
    // userId must be a full path segment, not a substring of the filename
    expect(
      canDeleteUploadObject({ path: `uploads/${OTHER}/${OWNER}.jpg`, userId: OWNER, role: 'customer' }),
    ).toBe(false);
  });
});
