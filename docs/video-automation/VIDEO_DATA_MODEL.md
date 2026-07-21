# Video Data Model

## Existing Tables To Reuse

- `match_pois`: POI catalog and editor surface.
- `tour_guide_spots`: geofence-ready stop rows with `poi_key`, localized content, audio URL, radii.
- `tour_room_messages`: Smart Guide chat feed. Arrival cards already use message `metadata`.
- `tour_room_spot_events`: duplicate-protected arrival/audio/meeting event ledger.
- `generated_spot_content`: booking-scoped generated mini-guides with provenance.
- `tour_audio_assets`: current generated audio asset table.
- `tour_content_jobs`: existing content generation job table.
- `creative_assets`, `asset_usage_logs`, `platform_publish_logs`: possible future marketing asset/publication reuse.

## Proposed Additive Tables For Later

Do not apply until admin approval and persistence are needed.

- `video_projects`
- `video_scripts`
- `video_storyboards`
- `video_renders`
- `video_quality_checks`
- `video_publications`
- `video_asset_links`

## Internal Manifest Shape

The Phase 1 CLI writes `asset-manifest.json`:

```json
{
  "poiId": "gyeongbokgung_palace",
  "version": 1,
  "targetLanguages": ["en", "zh-Hant", "ja", "es"],
  "assets": [],
  "sourceVideoStatus": "source_pending",
  "warnings": [],
  "jobKey": "stable-hash"
}
```

## License Rule

Assets default to `licenseStatus: "unknown"` and `publishable: false`. Automatic publication must only use assets where:

```text
licenseStatus == "cleared" AND publishable == true
```

