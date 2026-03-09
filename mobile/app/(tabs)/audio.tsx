import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  Alert,
  ActivityIndicator,
  TextInput,
  RefreshControl,
} from 'react-native';
import { theme } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { apiGet } from '@/api/client';
import { useAudioPlayback } from '@/hooks/useAudioPlayback';
import { useLocationTrigger } from '@/hooks/useLocationTrigger';
import { useDepartureAlarms } from '@/hooks/useDepartureAlarms';
import AudioPlayer from '@/components/audio-guide/AudioPlayer';
import type { TourSpot } from '@/constants/mockTourSpots';
import type {
  TourModeBookingSummary,
  TourModeContent,
  TourGuideSpot,
  TourFacility,
  ScheduleItem,
} from '@/types/tour-mode';

const DEMO_MP3 = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';

function guideSpotsToTourSpots(spots: TourGuideSpot[]): TourSpot[] {
  return spots.map((s) => ({
    id: s.id,
    title: s.title,
    description: s.description ?? '',
    audioUrl: s.audio_url || DEMO_MP3,
    latitude: Number(s.latitude),
    longitude: Number(s.longitude),
    triggerRadius: s.trigger_radius_m ?? 80,
  }));
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

const FACILITY_LABELS: Record<string, string> = {
  restroom: 'Restroom',
  ticket_office: 'Ticket office',
  convenience: 'Convenience',
  restaurant: 'Restaurant',
  other: 'Other',
};

/**
 * Tour Mode: for customers with a booking.
 * - List my bookings or guest lookup → load tour content.
 * - Audio spots (location-triggered), bus detail, facilities, schedule, departure alarms.
 */
export default function TourModeScreen() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;

  const [bookings, setBookings] = useState<TourModeBookingSummary[]>([]);
  const [content, setContent] = useState<TourModeContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guest lookup
  const [guestBookingId, setGuestBookingId] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [onBus, setOnBus] = useState(false);

  const [gpsEnabled, setGpsEnabled] = useState(true);

  const spots: TourSpot[] = content
    ? guideSpotsToTourSpots(content.tour_guide_spots)
    : [];

  const {
    currentSpot,
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
    error: playbackError,
  } = useAudioPlayback({
    spots,
    onSpotChange: () => {},
  });

  const onEnterSpot = useCallback(
    (spot: TourSpot) => {
      playSpot(spot);
    },
    [playSpot]
  );

  const { locationError, requestPermission } = useLocationTrigger({
    spots,
    onEnterSpot,
    enabled: gpsEnabled && content !== null,
    minMovementMeters: 15,
  });

  useDepartureAlarms(
    content?.schedule ?? [],
    content?.booking.tour_date ?? '',
    onBus,
    !!content && !!content.schedule?.length
  );

  const fetchBookings = useCallback(async () => {
    if (!token) {
      setBookings([]);
      setLoading(false);
      return;
    }
    try {
      const data = await apiGet<{ bookings: TourModeBookingSummary[] }>(
        '/api/tour-mode/bookings',
        undefined,
        token
      );
      setBookings(data.bookings || []);
      setError(null);
    } catch (e) {
      setBookings([]);
      setError(e instanceof Error ? e.message : 'Failed to load bookings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchBookings();
    } else {
      setLoading(false);
      setBookings([]);
    }
  }, [token, fetchBookings]);

  const loadContent = useCallback(
    async (bookingId: string, contactName?: string, contactEmail?: string) => {
      setError(null);
      try {
        const params: Record<string, string> = {};
        if (contactName) params.contactName = contactName;
        if (contactEmail) params.contactEmail = contactEmail;
        const data = await apiGet<TourModeContent>(
          `/api/tour-mode/booking/${bookingId}/content`,
          Object.keys(params).length ? params : undefined,
          token ?? undefined
        );
        setContent(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load tour content');
        Alert.alert('Error', e instanceof Error ? e.message : 'Failed to load tour content');
      }
    },
    [token]
  );

  const handleSelectBooking = useCallback(
    (bookingId: string) => {
      loadContent(bookingId);
    },
    [loadContent]
  );

  const handleGuestLookup = useCallback(async () => {
    const id = guestBookingId.trim();
    const name = guestName.trim();
    const email = guestEmail.trim();
    if (!id || !name || !email) {
      Alert.alert('Missing fields', 'Please enter Booking ID, your name, and email.');
      return;
    }
    setLookupLoading(true);
    try {
      await loadContent(id, name, email);
    } finally {
      setLookupLoading(false);
    }
  }, [guestBookingId, guestName, guestEmail, loadContent]);

  const handleGpsToggle = useCallback(
    async (value: boolean) => {
      if (value) {
        const granted = await requestPermission();
        if (!granted) {
          Alert.alert(
            'Location',
            'Location permission is needed to auto-play audio when you reach a tour spot.'
          );
          return;
        }
      }
      setGpsEnabled(value);
    },
    [requestPermission]
  );

  const clearContent = useCallback(() => {
    setContent(null);
    setOnBus(false);
  }, []);

  // ---------- Content view (tour loaded) ----------
  if (content) {
    const tourTitle = content.booking.tours?.title ?? 'Tour';
    const tourDate = content.booking.tour_date;

    return (
      <View style={styles.container}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Pressable onPress={clearContent} style={styles.backBtn}>
              <Text style={styles.backBtnText}>← Back</Text>
            </Pressable>
            <Text style={styles.title}>{tourTitle}</Text>
            <Text style={styles.subtitle}>{formatDate(tourDate)}</Text>
          </View>

          {content.bus_detail && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Bus details</Text>
              {content.bus_detail.payload.bus_number && (
                <Text style={styles.cardRow}>Bus: {content.bus_detail.payload.bus_number}</Text>
              )}
              {content.bus_detail.payload.driver_phone && (
                <Text style={styles.cardRow}>Driver: {content.bus_detail.payload.driver_phone}</Text>
              )}
              {content.bus_detail.payload.departure_time && (
                <Text style={styles.cardRow}>Departure: {content.bus_detail.payload.departure_time}</Text>
              )}
              {Object.entries(content.bus_detail.payload).map(
                ([k, v]) =>
                  !['bus_number', 'driver_phone', 'departure_time'].includes(k) &&
                  typeof v === 'string' && (
                    <Text key={k} style={styles.cardRow}>
                      {k}: {v}
                    </Text>
                  )
              )}
            </View>
          )}

          <View style={styles.onBusRow}>
            <Text style={styles.onBusLabel}>I'm on the bus (dismiss departure alarms)</Text>
            <Switch
              value={onBus}
              onValueChange={setOnBus}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              thumbColor="#fff"
            />
          </View>

          {content.schedule && content.schedule.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Schedule</Text>
              {content.schedule.map((item: ScheduleItem, i: number) => (
                <View key={i} style={styles.scheduleRow}>
                  <Text style={styles.scheduleTime}>{item.time ?? item.departure_time ?? '–'}</Text>
                  <Text style={styles.scheduleTitle}>{item.title ?? ''}</Text>
                  {item.departure_time && (
                    <Text style={styles.scheduleAlarm}>
                      Alarm 10 / 5 / 2 min before departure
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )}

          {spots.length > 0 && (
            <>
              <View style={styles.gpsRow}>
                <Text style={styles.gpsLabel}>GPS auto-play near spots</Text>
                <Switch
                  value={gpsEnabled}
                  onValueChange={handleGpsToggle}
                  trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                  thumbColor="#fff"
                />
              </View>
              {locationError ? (
                <Text style={styles.locationError}>{locationError}</Text>
              ) : null}

              <AudioPlayer
                spot={currentSpot}
                isPlaying={isPlaying}
                positionMillis={positionMillis}
                durationMillis={durationMillis}
                onPlay={play}
                onPause={pause}
                onNext={next}
                onPrevious={previous}
                onSeek={seekTo}
                isLoading={isLoading}
                error={playbackError}
              />
              <Text style={styles.listTitle}>Tour spots</Text>
              {spots.map((spot) => (
                <Pressable
                  key={spot.id}
                  style={({ pressed }) => [
                    styles.spotCard,
                    currentSpot?.id === spot.id && styles.spotCardActive,
                    pressed && styles.spotCardPressed,
                  ]}
                  onPress={() => playSpot(spot)}
                >
                  <Text style={styles.spotTitle} numberOfLines={1}>
                    {spot.title}
                  </Text>
                  <Text style={styles.spotDesc} numberOfLines={2}>
                    {spot.description}
                  </Text>
                  <Text style={styles.spotMeta}>
                    Trigger: {spot.triggerRadius}m
                  </Text>
                </Pressable>
              ))}
            </>
          )}

          {content.tour_facilities && content.tour_facilities.length > 0 && (
            <>
              <Text style={styles.listTitle}>Facilities</Text>
              {content.tour_facilities.map((f: TourFacility) => (
                <View key={f.id} style={styles.facilityCard}>
                  <Text style={styles.facilityType}>
                    {FACILITY_LABELS[f.type] ?? f.type}
                  </Text>
                  <Text style={styles.facilityName}>{f.name}</Text>
                  {f.details && typeof f.details === 'object' && Object.keys(f.details).length > 0 && (
                    <Text style={styles.facilityDetails}>
                      {JSON.stringify(f.details)}
                    </Text>
                  )}
                </View>
              ))}
            </>
          )}
        </ScrollView>
      </View>
    );
  }

  // ---------- Booking list / guest lookup ----------
  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchBookings(); }} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Tour Mode</Text>
          <Text style={styles.subtitle}>
            Select your booking to see tour guide, bus info, and facilities.
          </Text>
        </View>

        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : null}

        {token ? (
          <>
            {loading ? (
              <ActivityIndicator size="large" style={styles.loader} />
            ) : bookings.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No upcoming confirmed bookings.</Text>
                <Text style={styles.emptySubtext}>
                  Book a tour in the app and it will appear here.
                </Text>
              </View>
            ) : (
              <>
                <Text style={styles.listTitle}>Your upcoming tours</Text>
                {bookings.map((b) => (
                  <Pressable
                    key={b.id}
                    style={({ pressed }) => [styles.bookingCard, pressed && styles.spotCardPressed]}
                    onPress={() => handleSelectBooking(b.id)}
                  >
                    <Text style={styles.bookingTitle} numberOfLines={1}>
                      {b.tours?.title ?? 'Tour'}
                    </Text>
                    <Text style={styles.bookingDate}>{formatDate(b.tour_date)}</Text>
                    <Text style={styles.bookingMeta}>
                      {b.number_of_guests} guest{b.number_of_guests !== 1 ? 's' : ''} · {b.tours?.city ?? ''}
                    </Text>
                  </Pressable>
                ))}
              </>
            )}
          </>
        ) : null}

        <Text style={styles.listTitle}>Guest lookup</Text>
        <Text style={styles.guestHint}>
          Enter your booking ID (from confirmation email), name, and email.
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Booking ID"
          placeholderTextColor={theme.colors.textMuted}
          value={guestBookingId}
          onChangeText={setGuestBookingId}
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Your name"
          placeholderTextColor={theme.colors.textMuted}
          value={guestName}
          onChangeText={setGuestName}
        />
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={theme.colors.textMuted}
          value={guestEmail}
          onChangeText={setGuestEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Pressable
          style={[styles.lookupBtn, lookupLoading && styles.lookupBtnDisabled]}
          onPress={handleGuestLookup}
          disabled={lookupLoading}
        >
          {lookupLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.lookupBtnText}>Load my tour</Text>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: theme.spacing.xl,
  },
  loader: {
    marginVertical: theme.spacing.xl,
  },
  header: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  backBtn: {
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  backBtnText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  title: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    marginTop: 4,
  },
  errorText: {
    fontSize: theme.fontSize.sm,
    color: '#dc2626',
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  emptyCard: {
    marginHorizontal: theme.spacing.md,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  emptyText: {
    fontSize: theme.fontSize.base,
    fontWeight: '600',
    color: theme.colors.text,
  },
  emptySubtext: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    marginTop: 8,
  },
  listTitle: {
    fontSize: theme.fontSize.base,
    fontWeight: '600',
    color: theme.colors.text,
    paddingHorizontal: theme.spacing.md,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  bookingCard: {
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    padding: theme.spacing.md,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  bookingTitle: {
    fontSize: theme.fontSize.base,
    fontWeight: '600',
    color: theme.colors.text,
  },
  bookingDate: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    marginTop: 4,
  },
  bookingMeta: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  guestHint: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  input: {
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    padding: 12,
    backgroundColor: theme.colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    fontSize: theme.fontSize.base,
    color: theme.colors.text,
  },
  lookupBtn: {
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.sm,
    padding: 14,
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    alignItems: 'center',
  },
  lookupBtnDisabled: {
    opacity: 0.7,
  },
  lookupBtnText: {
    fontSize: theme.fontSize.base,
    fontWeight: '600',
    color: '#fff',
  },
  card: {
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardTitle: {
    fontSize: theme.fontSize.base,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 8,
  },
  cardRow: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    marginTop: 4,
  },
  onBusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.card,
    borderRadius: 12,
  },
  onBusLabel: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    fontWeight: '500',
    flex: 1,
  },
  scheduleRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  scheduleTime: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.text,
  },
  scheduleTitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    marginTop: 2,
  },
  scheduleAlarm: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  gpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.xs,
    backgroundColor: theme.colors.card,
    borderRadius: 12,
  },
  gpsLabel: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    fontWeight: '500',
  },
  locationError: {
    fontSize: theme.fontSize.xs,
    color: '#dc2626',
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  spotCard: {
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    padding: theme.spacing.md,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  spotCardActive: {
    borderColor: theme.colors.primary,
    borderWidth: 2,
  },
  spotCardPressed: {
    opacity: 0.9,
  },
  spotTitle: {
    fontSize: theme.fontSize.base,
    fontWeight: '600',
    color: theme.colors.text,
  },
  spotDesc: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 4,
  },
  spotMeta: {
    fontSize: 10,
    color: theme.colors.textMuted,
    marginTop: 6,
  },
  facilityCard: {
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    padding: theme.spacing.md,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  facilityType: {
    fontSize: theme.fontSize.xs,
    fontWeight: '600',
    color: theme.colors.primary,
    textTransform: 'uppercase',
  },
  facilityName: {
    fontSize: theme.fontSize.base,
    color: theme.colors.text,
    marginTop: 4,
  },
  facilityDetails: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 4,
  },
});
