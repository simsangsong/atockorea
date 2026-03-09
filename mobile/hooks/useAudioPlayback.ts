import { useState, useEffect, useRef, useCallback } from 'react';
import { Audio } from 'expo-av';
import type { TourSpot } from '@/constants/mockTourSpots';

/**
 * Configures the audio session for background playback.
 * Call once when the app or audio feature loads.
 * - iOS: staysActiveInBackground allows playback when screen is off.
 * - Android: shouldDuckAndroid and playThroughEarpieceAndroid affect behavior.
 */
export async function configureAudioSession(): Promise<void> {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  } catch (e) {
    console.warn('Audio session config failed:', e);
  }
}

export interface UseAudioPlaybackOptions {
  spots: TourSpot[];
  onSpotChange?: (spot: TourSpot | null) => void;
}

export interface UseAudioPlaybackReturn {
  currentSpot: TourSpot | null;
  currentIndex: number;
  isPlaying: boolean;
  positionMillis: number;
  durationMillis: number;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  playSpot: (spot: TourSpot) => Promise<void>;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  seekTo: (positionMillis: number) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook for audio playback using expo-av.
 * Manages a single Audio.Sound instance, loads/unloads by spot, and exposes play/pause/next/prev/seek.
 */
export function useAudioPlayback({
  spots,
  onSpotChange,
}: UseAudioPlaybackOptions): UseAudioPlaybackReturn {
  const [currentSpot, setCurrentSpot] = useState<TourSpot | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMillis, setPositionMillis] = useState(0);
  const [durationMillis, setDurationMillis] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const soundRef = useRef<Audio.Sound | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPositionInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const unloadSound = useCallback(async () => {
    stopPositionInterval();
    if (soundRef.current) {
      try {
        await soundRef.current.unloadAsync();
      } catch (e) {
        console.warn('Unload sound error:', e);
      }
      soundRef.current = null;
    }
    setPositionMillis(0);
    setDurationMillis(0);
    setIsPlaying(false);
  }, [stopPositionInterval]);

  const loadAndPlay = useCallback(
    async (spot: TourSpot) => {
      if (spots.length === 0) return;
      setIsLoading(true);
      setError(null);
      await unloadSound();

      try {
        const { sound } = await Audio.Sound.createAsync(
          { uri: spot.audioUrl },
          { shouldPlay: true },
          (status) => {
            if (status.isLoaded) {
              setDurationMillis(status.durationMillis ?? 0);
              if (status.didJustFinishAndNotReset) {
                setIsPlaying(false);
                setPositionMillis(0);
                stopPositionInterval();
              }
            }
          }
        );
        soundRef.current = sound;
        const status = await sound.getStatusAsync();
        if (status.isLoaded) {
          setDurationMillis(status.durationMillis ?? 0);
          setPositionMillis(status.positionMillis ?? 0);
        }
        setCurrentSpot(spot);
        setCurrentIndex(spots.findIndex((s) => s.id === spot.id));
        setIsPlaying(true);
        onSpotChange?.(spot);

        intervalRef.current = setInterval(async () => {
          const s = soundRef.current;
          if (!s) return;
          const st = await s.getStatusAsync();
          if (st.isLoaded) setPositionMillis(st.positionMillis ?? 0);
        }, 500);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Failed to load audio';
        setError(message);
        setCurrentSpot(null);
        setIsPlaying(false);
      } finally {
        setIsLoading(false);
      }
    },
    [spots, onSpotChange, unloadSound, stopPositionInterval]
  );

  const pause = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.pauseAsync();
      setIsPlaying(false);
      stopPositionInterval();
    }
  }, [stopPositionInterval]);

  const play = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.playAsync();
      setIsPlaying(true);
      const s = soundRef.current;
      intervalRef.current = setInterval(async () => {
        if (!s) return;
        const st = await s.getStatusAsync();
        if (st.isLoaded) setPositionMillis(st.positionMillis ?? 0);
      }, 500);
    } else if (currentSpot) {
      await loadAndPlay(currentSpot);
    } else if (spots.length > 0) {
      await loadAndPlay(spots[0]);
    }
  }, [currentSpot, spots, loadAndPlay]);

  const playSpot = useCallback(
    async (spot: TourSpot) => {
      await loadAndPlay(spot);
    },
    [loadAndPlay]
  );

  const next = useCallback(async () => {
    if (spots.length === 0) return;
    const nextIndex = (currentIndex + 1) % spots.length;
    await loadAndPlay(spots[nextIndex]);
  }, [spots, currentIndex, loadAndPlay]);

  const previous = useCallback(async () => {
    if (spots.length === 0) return;
    let prevIndex = currentIndex - 1;
    if (prevIndex < 0) prevIndex = spots.length - 1;
    await loadAndPlay(spots[prevIndex]);
  }, [spots, currentIndex, loadAndPlay]);

  const seekTo = useCallback(async (positionMillis: number) => {
    if (soundRef.current) {
      await soundRef.current.setPositionAsync(positionMillis);
      setPositionMillis(positionMillis);
    }
  }, []);

  useEffect(() => {
    configureAudioSession();
    return () => {
      stopPositionInterval();
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, [stopPositionInterval]);

  return {
    currentSpot,
    currentIndex,
    isPlaying,
    positionMillis,
    durationMillis,
    play,
    pause,
    playSpot,
    next,
    previous,
    seekTo,
    isLoading,
    error,
  };
}
