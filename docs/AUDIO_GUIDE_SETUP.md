# Audio Guide (Radio Tour) – Setup & Code Overview

## Terminal commands (already run)

From the **mobile** folder:

```bash
cd mobile
npx expo install expo-av expo-location
npx expo install @react-native-community/slider
```

## app.json configuration (already added)

- **iOS**
  - `infoPlist.NSLocationWhenInUseUsageDescription` – foreground location
  - `infoPlist.NSLocationAlwaysAndWhenInUseUsageDescription` – background location
  - `infoPlist.UIBackgroundModes`: `["audio", "location"]` – background audio + location
- **Android**
  - `permissions`: `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION`, `ACCESS_BACKGROUND_LOCATION`
- **Plugins**
  - `expo-location` with permission message

Background audio is configured in code via **expo-av** `Audio.setAudioModeAsync({ staysActiveInBackground: true })` in `hooks/useAudioPlayback.ts`.

## Code layout

| Path | Role |
|------|------|
| `constants/mockTourSpots.ts` | Mock spots: id, title, description, audioUrl, lat, lon, triggerRadius |
| `utils/distance.ts` | Haversine distance (meters) between two coordinates |
| `hooks/useAudioPlayback.ts` | expo-av: session config, load/play/pause/next/prev/seek, progress |
| `hooks/useLocationTrigger.ts` | expo-location: watch position, distance check, auto-play on enter radius |
| `components/audio-guide/AudioPlayer.tsx` | UI: title/description, progress bar, play/pause, next/prev |
| `app/(tabs)/audio.tsx` | Main screen: AudioPlayer + GPS toggle + list of spots |

## Flow

1. **Audio**: `useAudioPlayback` loads one `Audio.Sound` per spot, updates position/duration, exposes play/pause/next/prev/seek.
2. **Location**: `useLocationTrigger` requests permission, watches position, computes distance to each spot; when `distance <= spot.triggerRadius` it calls `onEnterSpot(spot)` so the main screen can `playSpot(spot)`.
3. **Background**: `configureAudioSession()` sets `staysActiveInBackground: true` so playback continues when the app is in the background (and screen off).

## Replacing mock data

- Replace `MOCK_TOUR_SPOTS` in `constants/mockTourSpots.ts` with API data or import from your backend.
- Use real MP3 URLs (e.g. from your CDN) instead of the dummy `DEMO_MP3` link.
