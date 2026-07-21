# Video QC Rules

## Automated Checks In Phase 1

- Exactly four target language outputs unless overridden.
- Script duration is 60 seconds.
- WebVTT and SRT paths exist for each language.
- Narration placeholder exists for each language.
- Asset license status blocks auto-publication until cleared.
- FFmpeg availability is recorded.
- FFprobe availability is recorded.
- MP4 render availability is recorded.

## Future Media Checks

When FFmpeg/ffprobe and real source clips are available:

- Duration between 55 and 65 seconds.
- Resolution `1080x1920` for app/Reels output.
- Aspect ratio `9:16`.
- Audio track exists.
- No clipping.
- Captions exist and stay in safe area.
- Poster generated.
- File is playable.
- Black/blank frame detection passes.
- Logo and CTA are present.
- Source video and POI semantic match passes.
- Duplicate scene ratio is below threshold.

## Manual Approval

Initial versions must always land in `awaiting_publish_approval`. Production Facebook posting and app exposure require admin approval.

