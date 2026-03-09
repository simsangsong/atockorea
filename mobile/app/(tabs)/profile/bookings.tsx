import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Image,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { theme } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { apiGet, apiDelete } from '@/api/client';
import { BASE_URL } from '@/api/client';

interface Booking {
  id: string;
  tour_id: string;
  booking_date: string;
  tour_date?: string;
  number_of_guests: number;
  final_price: number;
  status: string;
  payment_status: string;
  tours: { id: string; title: string; city: string; image_url: string } | null;
}

interface BookingsResponse {
  bookings: Booking[];
}

function formatDate(s: string) {
  const d = new Date(s);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatPrice(n: number) {
  return `₩${Number(n).toLocaleString()}`;
}

export default function ProfileBookingsScreen() {
  const router = useRouter();
  const { session, user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token = session?.access_token ?? null;

  const fetchBookings = async () => {
    if (!token) {
      setBookings([]);
      setLoading(false);
      return;
    }
    try {
      const data = await apiGet<BookingsResponse>('/api/bookings', undefined, token);
      setBookings(data.bookings || []);
      setError(null);
    } catch (e: unknown) {
      setBookings([]);
      setError(e instanceof Error ? e.message : 'Failed to load bookings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    fetchBookings();
  }, [user, token]);

  const canCancel = (b: Booking): boolean => {
    if (b.status !== 'confirmed' && b.status !== 'pending') return false;
    const tourDate = new Date(b.tour_date || b.booking_date);
    const hoursUntil = (tourDate.getTime() - Date.now()) / (1000 * 60 * 60);
    return hoursUntil > 24;
  };

  const handleCancel = (booking: Booking) => {
    if (!canCancel(booking)) {
      Alert.alert(
        'Cannot cancel',
        'Cancellation is not allowed within 24 hours of the tour. Please contact support.'
      );
      return;
    }
    Alert.alert(
      'Cancel booking?',
      'Are you sure you want to cancel this booking?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          style: 'destructive',
          onPress: async () => {
            if (!token) return;
            try {
              await apiDelete(`/api/bookings/${booking.id}`, token);
              await fetchBookings();
            } catch (e: unknown) {
              Alert.alert('Error', e instanceof Error ? e.message : 'Failed to cancel');
            }
          },
        },
      ]
    );
  };

  if (!user) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Sign in to view your bookings.</Text>
      </View>
    );
  }

  if (loading && bookings.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchBookings(); }} />
      }
    >
      {error && <Text style={styles.errorText}>{error}</Text>}
      {bookings.length === 0 && !loading && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No bookings yet.</Text>
          <Pressable style={styles.browseBtn} onPress={() => router.push('/(tabs)')}>
            <Text style={styles.browseBtnText}>Browse tours</Text>
          </Pressable>
        </View>
      )}
      {bookings.map((b) => {
        const imageUrl = b.tours?.image_url
          ? (b.tours.image_url.startsWith('http')
            ? b.tours.image_url
            : `${BASE_URL.replace(/\/$/, '')}${b.tours.image_url}`)
          : null;
        return (
          <View key={b.id} style={styles.card}>
            <View style={styles.cardRow}>
              {imageUrl ? (
                <Image source={{ uri: imageUrl }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.thumbPlaceholder]} />
              )}
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={2}>{b.tours?.title ?? 'Tour'}</Text>
                <Text style={styles.cardMeta}>{b.tours?.city ?? ''} · {formatDate(b.tour_date || b.booking_date)}</Text>
                <Text style={styles.cardGuests}>{b.number_of_guests} guest(s) · {formatPrice(b.final_price)}</Text>
                <View style={styles.cardFooter}>
                  <View style={[styles.badge, b.status === 'confirmed' && styles.badgeConfirmed]}>
                    <Text style={styles.badgeText}>{b.status}</Text>
                  </View>
                  {canCancel(b) && (
                    <Pressable onPress={() => handleCancel(b)} style={styles.cancelBtn}>
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.md, paddingBottom: theme.spacing.xl },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: theme.spacing.lg },
  errorText: { color: '#dc2626', textAlign: 'center', marginBottom: theme.spacing.md },
  empty: { alignItems: 'center', paddingVertical: theme.spacing.xl },
  emptyText: { fontSize: 15, color: theme.colors.textMuted, marginBottom: theme.spacing.md },
  browseBtn: { backgroundColor: theme.colors.primary, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8 },
  browseBtnText: { color: '#fff', fontWeight: '500', fontSize: 15 },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  cardRow: { flexDirection: 'row', padding: theme.spacing.sm },
  thumb: { width: 80, height: 80, borderRadius: 8 },
  thumbPlaceholder: { backgroundColor: theme.colors.border },
  cardBody: { flex: 1, marginLeft: theme.spacing.sm },
  cardTitle: { fontWeight: '500', color: theme.colors.text, fontSize: 14 },
  cardMeta: { fontSize: 12, color: theme.colors.textMuted, marginTop: 4 },
  cardGuests: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: theme.colors.border },
  badgeConfirmed: { backgroundColor: '#d1fae5' },
  badgeText: { fontSize: 11, fontWeight: '500', color: theme.colors.text },
  cancelBtn: { paddingVertical: 4 },
  cancelBtnText: { fontSize: 12, color: '#dc2626', fontWeight: '500' },
});
