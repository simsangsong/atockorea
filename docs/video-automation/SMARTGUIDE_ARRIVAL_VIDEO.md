# Smart Guide Arrival Video

## Existing Flow

The app already has:

- `lib/tour-room/geo.ts`: accuracy, dwell, speed guard, hysteresis.
- `lib/tour-room/spotWatcher.ts`: nearest-spot handling and cooldown.
- `hooks/useSpotGeofence.ts`: posts `arrived` events.
- `app/api/tour-rooms/[bookingId]/spot-events/route.ts`: writes arrival messages and duplicate-protected spot events.
- `components/tour-mode/ChatFeed.tsx`: renders `metadata.kind === "spot_arrival"` as a rich arrival card when content exists.

## Video Card Contract

Phase 1 writes:

```text
app-video-card.json
```

Shape:

```json
{
  "type": "poi_video",
  "poiId": "gyeongbokgung_palace",
  "posterUrl": "...",
  "duration": 60,
  "version": 1,
  "languages": []
}
```

## Phase 3 Integration

On arrival:

1. Resolve latest approved video for `poi_key` and viewer language.
2. Insert or attach `metadata.video_card`.
3. Render a video card in ChatFeed.
4. Show poster or muted preview only.
5. Play full video only after user tap.
6. Record events: `card_shown`, `preview_started`, `video_started`, `25_percent`, `50_percent`, `75_percent`, `completed`, `dismissed`, `replayed`.

## Privacy

Use current dwell/speed/accuracy guards. Do not increase location retention for video analytics.

