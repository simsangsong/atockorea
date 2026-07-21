# Video Pipeline Setup

## Command

```bash
npm run video:generate -- --poi=gyeongbokgung_palace --dry-run
```

Optional:

```bash
npm run video:generate -- --poi=gyeongbokgung_palace --tour=from-incheon-seoul-day-tour-cruise-guests --languages=en,zh-Hant,ja,es --dry-run
```

## Output

Artifacts are written to:

```text
.tmp/video-automation/<poiId>/v<version>-<hash>/
```

Key files:

- `asset-manifest.json`
- `source.json`
- `scripts/<language>.script.json`
- `storyboards/<language>.storyboard.json`
- `subtitles/<language>.vtt`
- `subtitles/<language>.srt`
- `narration/<language>.txt`
- `narration/<language>.wav`
- `poster/<poiId>.png`
- `app-video-card.json`
- `publication/facebook.dry-run.json`
- `qc-report.json`
- `run-summary.json`

## FFmpeg

The current machine does not have `ffmpeg` or `ffprobe` on PATH. Install them before expecting MP4 output:

```bash
ffmpeg -version
ffprobe -version
```

If Windows has installed FFmpeg but the current shell has not picked up the updated PATH yet, pass explicit paths:

```powershell
$env:FFMPEG_PATH="C:\Users\sangsong\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.2-full_build\bin\ffmpeg.exe"
$env:FFPROBE_PATH="C:\Users\sangsong\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.2-full_build\bin\ffprobe.exe"
npm run video:generate -- --poi=gyeongbokgung_palace --dry-run
```

When available, the CLI attempts a poster-plus-narration placeholder MP4 per language. Final production rendering should replace the poster-only source with real video clips once source footage is provided.

## Installed Video Skills

The following Codex skills were installed from the user-provided GitHub sources:

- HyperFrames and supporting skills: `hyperframes`, `general-video`, `media-use`, `embedded-captions`, `motion-graphics`, `talking-head-recut`, and core HyperFrames domain skills.
- `video-use`
- selected Generative Media skills: `media`, `storyboard`, `social-media-video`, `seedance-2`, `one-shot-video`
- `interflow-video-cut`
- local ATOCKOREA orchestrator: `atockorea-ai-video-workflow`

Codex skill discovery may require the next user turn before these appear in the active skill list. The current dry-run CLI still works without them.

## Environment Variables

No external credentials are required for dry-run.

Future non-dry-run integrations should use:

- `OPENAI_API_KEY`
- `OPENAI_TTS_MODEL`
- `OPENAI_TTS_VOICE`
- `FFMPEG_PATH`
- `FFPROBE_PATH`
- `MUAPI_KEY`
- `HEYGEN_API_KEY`
- `ELEVENLABS_API_KEY`
- `VOLC_ASR_API_KEY`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `META_APP_ID`
- `META_APP_SECRET`
- `META_PAGE_ID`
- `META_PAGE_ACCESS_TOKEN`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`

Never commit real secret values.
