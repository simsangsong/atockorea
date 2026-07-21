# Meta Publishing Setup

Checked against official Meta developer documentation on 2026-07-20.

Official references:

- [Video API Get Started](https://developers.facebook.com/documentation/video-api/getting-started)
- [Video API Publishing](https://developers.facebook.com/documentation/video-api/guides/publishing)
- [Page Videos Graph API Reference](https://developers.facebook.com/docs/graph-api/reference/page/videos/)
- [Graph API Rate Limits](https://developers.facebook.com/docs/graph-api/overview/rate-limiting/)

## Policy

- Use native Facebook Page/Reels video upload, not a shared Cloudinary URL.
- Do not publish to the production Page without explicit admin approval.
- Keep a staging Page/token path for tests.
- Store duplicate keys before publishing to avoid reposting the same POI/version/language.
- Use dry-run payloads when credentials are missing.

## Required Env

- `META_APP_ID`
- `META_APP_SECRET`
- `META_PAGE_ID`
- `META_PAGE_ACCESS_TOKEN`

## Phase 1 Payload

The CLI writes:

```text
publication/facebook.dry-run.json
```

This includes title, description, hashtags, cover path, video path if rendered, duplicate key, and approval requirement.

## Future Adapter

Implement a `MetaPublisher` interface with:

- `validateCredentials()`
- `startUploadSession()`
- `uploadVideo()`
- `finishUpload()`
- `pollStatus()`
- `scheduleOrPublish()`
- `recordPublication()`
- `dryRun()`

Use official Meta docs at implementation time, because permissions and upload requirements change.

