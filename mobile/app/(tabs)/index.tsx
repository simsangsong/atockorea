import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { apiGet } from '@/api/client';
import { theme } from '@/constants/theme';
import type { Tour } from '@/types/tour';
import AppHeader from '@/components/AppHeader';
import HeroSection from '@/components/home/HeroSection';
import PaymentStrip from '@/components/home/PaymentStrip';
import TrustBar from '@/components/home/TrustBar';
import DestinationsCards from '@/components/home/DestinationsCards';
import TourCard from '@/components/home/TourCard';
import BusinessSection from '@/components/home/BusinessSection';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PAD = theme.spacing.md;
const GAP = theme.spacing.sm;
const CARD_WIDTH = (SCREEN_WIDTH - PAD * 2 - GAP) / 2;

interface ToursResponse {
  tours: Tour[];
  total?: number;
}

export default function HomeScreen() {
  const [tours, setTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<ToursResponse>('/api/tours', { limit: '20', sortBy: 'rating', sortOrder: 'desc' })
      .then((res) => setTours(res.tours || []))
      .catch(() => setTours([]))
      .finally(() => setLoading(false));
  }, []);

  const popularTours = tours.slice(0, 4);

  return (
    <View style={styles.container}>
      <AppHeader />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <HeroSection />
        <PaymentStrip />
        <TrustBar />
        <DestinationsCards />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Popular Tours</Text>
          {loading ? (
            <ActivityIndicator size="small" color={theme.colors.primary} style={styles.loader} />
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            >
              {popularTours.map((tour) => (
                <View key={tour.id} style={styles.cardWrap}>
                  <TourCard tour={tour} compact />
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>All Tours</Text>
          {loading ? (
            <ActivityIndicator size="small" color={theme.colors.primary} style={styles.loader} />
          ) : (
            <View style={styles.grid}>
              {tours.map((tour) => (
                <View key={tour.id} style={styles.gridItem}>
                  <TourCard tour={tour} grid />
                </View>
              ))}
            </View>
          )}
        </View>

        <BusinessSection />
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
  content: {
    paddingBottom: theme.spacing.xl,
  },
  section: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: PAD,
  },
  sectionTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  horizontalList: {
    gap: GAP,
    paddingRight: PAD,
  },
  cardWrap: {
    marginRight: GAP,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  gridItem: {
    width: CARD_WIDTH,
  },
  loader: {
    marginVertical: theme.spacing.lg,
  },
});
