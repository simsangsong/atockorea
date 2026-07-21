# Video Skill Audit

Audit date: 2026-07-20

## Current Status

The requested video skills were initially absent from the Codex environment. After the user provided verified GitHub sources, the following skills were installed into `C:\Users\sangsong\.codex\skills`.

Codex skill discovery usually refreshes on the next user turn, but the installed files are present on disk now.

| Skill | Installed | Currently executable | Role | Additional setup | Use as-is | ATOCKOREA adapter needed | Overlap | Do not use when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| HyperFrames | Yes | Partially | Primary branded HTML/CSS/JS video composition and render layer | `ffmpeg`, `ffprobe`, browser deps, optional HeyGen auth for media-use | Yes for rendering/composition after deps | Yes, for POI facts, licensing, app/Facebook payloads | FFmpeg, Remotion-style rendering | Facts/rights are unclear or production approval is missing |
| HyperFrames `media-use` | Yes | Partially | Media ledger, TTS/BGM/SFX/logo/image/video resolve, provenance | `ffmpeg`, `ffprobe`, HeyGen CLI/auth for free path | Partially | Yes, for ATOCKOREA media rights and generated-media labels | Generative Media, local TTS | Paid/provider calls without approval |
| HyperFrames `embedded-captions` | Yes | Blocked until deps | Caption workflows for existing talking-head footage | `ffmpeg`, `ffprobe`, HyperFrames CLI, local transcription deps | Yes for talking-head captions | Minor, for brand language/safe areas | Interflow Video Cut | Scenic B-roll or non-human subject |
| HyperFrames `motion-graphics` | Yes | Partially | Short maps, title hits, lower thirds, CTA, logo/motion cards | HyperFrames CLI, `ffmpeg` for render | Yes for short graphics | Yes, for ATOCKOREA brand tokens | General-video | Longer narrated POI video |
| HyperFrames `talking-head-recut` | Yes | Blocked until deps | Designed overlay cards on guide/representative/interview videos | `ffmpeg`, `ffprobe`, HyperFrames CLI | Yes for talking-head packaging | Yes, for ATOCKOREA brand/outro | Interflow Video Cut | Scenic/B-roll-only POI content |
| video-use | Yes | Blocked until deps/provider | Source footage analysis, cut selection, B-roll edit, EDL/final.mp4 | `ffmpeg`, `ffprobe`, ElevenLabs/Scribe setup per skill | Partially | Yes, because it is audio-first and ATOCKOREA needs silent tourism B-roll handling | HyperFrames media-use ops | No source clips or no edit strategy confirmation |
| Generative Media | Selected subset installed | Blocked until MuAPI setup | Limited generated thumbnails, storyboard keyframes, abstract/mood/video filler | `MUAPI_KEY`, `muapi-cli`, paid-call approval | No for factual POI footage | Yes, provenance and admin approval required | HyperFrames media-use image/video generation | Recreating real cultural sites/facilities as factual footage |
| Video Cut / Interflow | Yes | Blocked until deps/provider | Talking-head card-based videos | `ffmpeg`, `ffprobe`, `vtake`, optional ElevenLabs/Volc ASR | Partially | Yes, remove/swap Interflow branding and align with ATOCKOREA | HyperFrames talking-head-recut | Scenic/B-roll tourism videos |
| ATOCKOREA AI Video Workflow | Yes | Yes as guidance | Project-specific orchestrator and policy layer | None for dry-run; external deps for render/publish | Yes | It is the adapter | HyperFrames router | Do not use to bypass external skill contracts |

## Installed Sources

- HyperFrames: `https://github.com/heygen-com/hyperframes`
  - Installed: `hyperframes`, `hyperframes-core`, `hyperframes-cli`, `hyperframes-creative`, `hyperframes-animation`, `hyperframes-keyframes`, `hyperframes-registry`, `general-video`, `media-use`, `embedded-captions`, `motion-graphics`, `talking-head-recut`.
- video-use: `https://github.com/browser-use/video-use`
- Generative Media Skills: `https://github.com/SamurAIGPT/Generative-Media-Skills`
  - Installed subset: `media`, `storyboard`, `social-media-video`, `seedance-2`, `one-shot-video`.
- Video Cut: `https://github.com/derek-zhuolin/interflow-video-cut`
- ATOCKOREA local orchestrator: `C:\Users\sangsong\.codex\skills\atockorea-ai-video-workflow`

## Executability Check

- `npx hyperframes --version` succeeds and resolved `0.7.64`.
- `npx hyperframes browser ensure` installed Chrome Headless Shell at `C:\Users\sangsong\.cache\hyperframes\chrome\chrome-headless-shell\win64-152.0.7928.2\chrome-headless-shell-win64\chrome-headless-shell.exe`.
- `winget` installed FFmpeg `8.1.2`; the current Codex process has not refreshed PATH, so use `FFMPEG_PATH` and `FFPROBE_PATH` until the shell/app restarts.
- `npx hyperframes doctor` still reports optional missing local providers: `whisper-cpp`, Kokoro TTS, MusicGen, and Docker.
- `npx -y @notedit/vtake@latest doctor` sees Node, fonts, and GSAP but needs FFmpeg/ffprobe on PATH or explicit environment handling.
- `muapi` and `heygen` CLI commands are not currently on PATH.
- Provider credentials are not configured in this audit: `MUAPI_KEY`, HeyGen auth, ElevenLabs/Volc ASR, Cloudinary, and Meta tokens remain unset/unchecked.

## Project Fallback Still Required

Until source footage and executable dependencies are available:

- `lib/video-automation/*` remains the project-local contract layer.
- `scripts/generate-poi-video.ts` remains the idempotent dry-run CLI.
- QC should report blocked render states honestly instead of inventing external-skill output.
- Production Facebook publishing and Smart Guide exposure remain admin-gated.
