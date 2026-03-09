import React from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import Slider from '@react-native-community/slider';
import { theme } from '@/constants/theme';
import type { TourSpot } from '@/constants/mockTourSpots';
function formatTime(millis: number): string {
  if (!Number.isFinite(millis) || millis < 0) return '0:00';
  const totalSeconds = Math.floor(millis / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

interface AudioPlayerProps {
  spot: TourSpot | null;
  isPlaying: boolean;
  positionMillis: number;
  durationMillis: number;
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSeek: (positionMillis: number) => void;
  isLoading: boolean;
  error: string | null;
}

export default function AudioPlayer({
  spot,
  isPlaying,
  positionMillis,
  durationMillis,
  onPlay,
  onPause,
  onNext,
  onPrevious,
  onSeek,
  isLoading,
  error,
}: AudioPlayerProps) {
  const durationSafe = durationMillis > 0 ? durationMillis : 1;
  const value = Math.min(positionMillis / durationSafe, 1);

  if (error) {
    return (
      <View style={styles.card}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>
          {spot ? spot.title : 'Select a spot or walk to trigger'}
        </Text>
        <Text style={styles.description} numberOfLines={3}>
          {spot ? spot.description : 'Audio will auto-play when you enter a tour spot.'}
        </Text>
      </View>

      <View style={styles.progressRow}>
        <Text style={styles.time}>{formatTime(positionMillis)}</Text>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={1}
          value={value}
          onSlidingComplete={(v) => onSeek(v * durationMillis)}
          minimumTrackTintColor={theme.colors.primary}
          maximumTrackTintColor={theme.colors.border}
          thumbTintColor={theme.colors.primary}
        />
        <Text style={styles.time}>{formatTime(durationMillis)}</Text>
      </View>

      <View style={styles.controls}>
        <Pressable
          style={({ pressed }) => [styles.controlBtn, pressed && styles.controlBtnPressed]}
          onPress={onPrevious}
          disabled={isLoading}
        >
          <Text style={styles.controlIcon}>⏮</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.playBtn, pressed && styles.controlBtnPressed]}
          onPress={isPlaying ? onPause : onPlay}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.playIcon}>{isPlaying ? '⏸' : '▶'}</Text>
          )}
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.controlBtn, pressed && styles.controlBtnPressed]}
          onPress={onNext}
          disabled={isLoading}
        >
          <Text style={styles.controlIcon}>⏭</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    padding: theme.spacing.lg,
    marginHorizontal: theme.spacing.md,
    marginVertical: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  info: {
    marginBottom: theme.spacing.md,
  },
  title: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 4,
  },
  description: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    lineHeight: 20,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: theme.spacing.md,
  },
  time: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    minWidth: 36,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  controlBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  controlBtnPressed: {
    opacity: 0.8,
  },
  playBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    fontSize: 28,
    color: '#fff',
  },
  controlIcon: {
    fontSize: 20,
    color: theme.colors.text,
  },
  errorText: {
    fontSize: theme.fontSize.sm,
    color: '#dc2626',
  },
});
