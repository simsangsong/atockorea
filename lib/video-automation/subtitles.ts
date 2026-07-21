import type { VideoScript } from '@/lib/video-automation/types';

function pad(value: number, width = 2): string {
  return String(value).padStart(width, '0');
}

export function formatVttTime(totalSeconds: number): string {
  const millis = Math.round((totalSeconds % 1) * 1000);
  const whole = Math.floor(totalSeconds);
  const seconds = whole % 60;
  const minutes = Math.floor(whole / 60) % 60;
  const hours = Math.floor(whole / 3600);
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${pad(millis, 3)}`;
}

export function formatSrtTime(totalSeconds: number): string {
  return formatVttTime(totalSeconds).replace('.', ',');
}

export function buildWebVtt(script: VideoScript): string {
  const cues = script.scenes.map((scene) => {
    return [
      scene.sceneId,
      `${formatVttTime(scene.start)} --> ${formatVttTime(scene.end)}`,
      scene.narration,
    ].join('\n');
  });
  return ['WEBVTT', '', ...cues].join('\n\n') + '\n';
}

export function buildSrt(script: VideoScript): string {
  const cues = script.scenes.map((scene, index) => {
    return [
      String(index + 1),
      `${formatSrtTime(scene.start)} --> ${formatSrtTime(scene.end)}`,
      scene.narration,
    ].join('\n');
  });
  return cues.join('\n\n') + '\n';
}

