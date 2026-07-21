# Video Security And Privacy

## Secrets

- Never commit API keys.
- Use environment variables for OpenAI, Cloudinary, Meta, and Supabase.
- Redact tokens and signed URLs in logs.

## External Calls

- Dry-run must not call paid AI APIs or publishing APIs.
- Production posting requires admin approval.
- Use retry with backoff for upload/publish adapters.
- Validate webhook signatures before trusting callbacks.

## Media Safety

- Do not publish assets with unclear rights.
- Track source, checksum, license, owner, expiration, and review status.
- Mark AI-generated media and AI-generated voices in metadata.
- Do not use generated media to impersonate real cultural-site footage.

## Location Privacy

- Reuse existing Smart Guide arrival guards.
- Store video analytics as event names and POI/video IDs, not raw continuous location.
- Keep arrival detection on-device where possible.
- Provide non-location alternatives such as QR, map check-in, or manual guide trigger.

