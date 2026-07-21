# Video Operations Runbook

## Generate A Dry Run

```bash
npm run video:generate -- --poi=gyeongbokgung_palace --dry-run
```

Review:

```text
.tmp/video-automation/<poiId>/<version>/run-summary.json
.tmp/video-automation/<poiId>/<version>/qc-report.json
```

## Common Outcomes

- `warning` with `blocked_by_missing_ffmpeg`: install FFmpeg/ffprobe or configure PATH.
- `source_pending`: expected until original video clips are supplied.
- `licenseStatus: unknown`: expected until asset rights are reviewed.
- `awaiting_media_source`: expected when no MP4 render exists.

## Retry

The output path is deterministic by POI, version, and language list. Re-running the same command refreshes the same artifact set.

## Promotion Checklist

- Source footage attached.
- License reviewed.
- FFmpeg/ffprobe available.
- MP4 generated per language or audio-track strategy approved.
- QC passed.
- Admin approved script, captions, narration, poster, video, and publication copy.
- External publishing credentials configured in staging.
- Production publish explicitly approved.

