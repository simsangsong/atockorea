/**
 * Tours list – same data as web (GET /api/tours).
 * Optional: city, search, sortBy, sortOrder, limit.
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  TextInput,
  Dimensions,
} from 'react-native';
import { apiGet } from '@/api/client';
import { theme } from '@/constants/theme';
import type { Tour } from '@/types/tour';
import TourCard from '@/components/home/TourCard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PAD = theme.spacing.md;
const GAP = theme.spacing.sm;
const CARD_WIDTH = (SCREEN_WIDTH - PAD * 2 - GAP) / 2;

interface ToursResponse {
  tours: Tour[];
  total?: number;
}

export default function ToursScreen() {
  const [tours, setTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('');

  useEffect(() => {
    const params: Record<string, string> = {
      limit: '50',
      sortBy: 'rating',
      sortOrder: 'desc',
    };
    if (city.trim()) params.city = city.trim();
    if (search.trim()) params.search = search.trim();
    apiGet<ToursResponse>('/api/tours', params)
      .then((res) => setTours(res.tours || []))
      .catch(() => setTours([]))
      .finally(() => setLoading(false));
  }, [city, search]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Tours</Text>
        <Text style={styles.subtitle}>Browse all tours. Same data as the website.</Text>
      </View>
      <View style={styles.filters}>
        <TextInput
          style={styles.input}
          placeholder="Search tours..."
          placeholderTextColor={theme.colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        <TextInput
          style={styles.input}
          placeholder="City (e.g. Jeju, Seoul)"
          placeholderTextColor={theme.colors.textMuted}
          value={city}
          onChangeText={setCity}
        />
      </View>
      {loading ? (
        <ActivityIndicator size="large" color={theme.colors.primary} style={styles.loader} />
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.grid}>
            {tours.map((tour) => (
              <View key={String(tour.id)} style={styles.gridItem}>
                <TourCard tour={tour} grid />
              </View>
            ))}
          </View>
          {tours.length === 0 && (
            <Text style={styles.empty}>No tours found. Try different filters.</Text>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingHorizontal: PAD,
    paddingTop: PAD,
    paddingBottom: theme.spacing.sm,
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
  filters: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: PAD,
    marginBottom: PAD,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: theme.colors.text,
  },
  scroll: { flex: 1 },
  content: { paddingHorizontal: PAD, paddingBottom: theme.spacing.xl },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  gridItem: {
    width: CARD_WIDTH,
  },
  loader: { flex: 1, justifyContent: 'center' },
  empty: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: theme.spacing.xl,
  },
});
