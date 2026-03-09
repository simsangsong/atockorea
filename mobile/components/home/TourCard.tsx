import React from 'react';
import { View, Text, Pressable, Image, StyleSheet, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '@/constants/theme';
import { BASE_URL } from '@/api/client';
import type { Tour } from '@/types/tour';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PAD = theme.spacing.md;
const GAP = theme.spacing.sm;
const CARD_WIDTH = (SCREEN_WIDTH - PAD * 2 - GAP) / 2;

function formatPrice(n: number): string {
  return `₩${n.toLocaleString()}`;
}

function formatDuration(d: string | undefined): string {
  if (!d || !d.trim()) return '';
  const s = d.trim().toLowerCase();
  const h = s.match(/(\d+)\s*h(?:our)?s?/);
  const m = s.match(/(\d+)\s*m(?:in)?/);
  if (h && m) return `${h[1]}h ${m[1]}m`;
  if (h) return `${h[1]}h`;
  if (m) return `${m[1]}m`;
  return d.length <= 8 ? d : '';
}

interface TourCardProps {
  tour: Tour;
  grid?: boolean;
  compact?: boolean;
  fullWidth?: boolean;
}

export default function TourCard({ tour, grid, compact, fullWidth }: TourCardProps) {
  const router = useRouter();
  const imageUri = tour.image
    ? tour.image.startsWith('http')
      ? tour.image
      : `${BASE_URL.replace(/\/$/, '')}${tour.image.startsWith('/') ? '' : '/'}${tour.image}`
    : undefined;

  const handlePress = () => {
    const id = tour.slug || String(tour.id);
    router.push(`/tour/${encodeURIComponent(id)}`);
  };

  const isGrid = grid === true;
  const cardW = fullWidth ? '100%' : isGrid ? CARD_WIDTH : compact ? 200 : 280;
  const imageHeight = isGrid ? 112 : 140;

  const originalPrice = tour.originalPrice ?? tour.original_price;
  const hasDiscount = originalPrice != null && originalPrice > tour.price;
  const discountPercent = hasDiscount
    ? Math.round(((originalPrice - tour.price) / originalPrice) * 100)
    : 0;
  const reviewCount = tour.reviewCount ?? tour.review_count ?? 0;
  const durationStr = formatDuration(tour.duration);
  const isDayTour = tour.tag?.toLowerCase().includes('day') ?? true;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, { width: cardW }, pressed && styles.pressed]}
      onPress={handlePress}
    >
      <View style={[styles.imageWrap, { height: imageHeight }]}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]} />
        )}
        {/* Gradient only at the bottom edge (image ↔ white junction), not over the whole photo */}
        <LinearGradient
          colors={['transparent', 'transparent', 'rgba(255,255,255,0.92)']}
          locations={[0, 0.9, 1]}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        {/* Top-left: Day tour badge (blue) - hide in compact */}
        {isDayTour && !compact && (
          <View style={styles.badgeDay}>
            <Text style={styles.badgeDayText}>Day tour</Text>
          </View>
        )}
        {/* Top-right: Discount % (red) + Heart */}
        <View style={styles.topRight}>
          {hasDiscount && discountPercent > 0 && !compact && (
            <View style={styles.badgeDiscount}>
              <Text style={styles.badgeDiscountText}>{discountPercent}% OFF</Text>
            </View>
          )}
          <View style={styles.heartWrap}>
            <Text style={styles.heartIcon}>♡</Text>
          </View>
        </View>
        {/* Bottom-left: Rating (only in grid or when not compact) */}
        {!compact && tour.rating != null && (
          <View style={styles.ratingBadge}>
            <Text style={styles.ratingText}>⭐ {tour.rating.toFixed(1)}</Text>
          </View>
        )}
      </View>
      <View style={styles.body}>
        <View style={styles.locationRow}>
          <Text style={styles.pinIcon}>📍</Text>
          <Text style={styles.location} numberOfLines={1}>
            {tour.city}
          </Text>
        </View>
        <Text style={styles.title} numberOfLines={2}>
          {tour.title}
        </Text>
        {!compact && (
          <View style={styles.metaRow}>
            {tour.rating != null && (
              <Text style={styles.metaText}>
                ⭐ {tour.rating.toFixed(1)}
                {reviewCount > 0 ? ` (${reviewCount})` : ''}
              </Text>
            )}
            {durationStr ? (
              <Text style={styles.metaText}>🕒 {durationStr}</Text>
            ) : null}
          </View>
        )}
        <View style={styles.priceRow}>
          {hasDiscount && !compact && (
            <Text style={styles.originalPrice}>{formatPrice(originalPrice!)}</Text>
          )}
          <Text style={styles.price}>{formatPrice(tour.price)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  pressed: {
    opacity: 0.92,
  },
  imageWrap: {
    position: 'relative',
    height: 120,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    backgroundColor: theme.colors.border,
  },
  badgeDay: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#2563eb',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeDayText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  topRight: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgeDiscount: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeDiscountText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  heartWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heartIcon: {
    fontSize: 14,
    color: '#64748b',
  },
  ratingBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ratingText: {
    fontSize: 10,
    color: theme.colors.white,
  },
  body: {
    padding: 10,
    backgroundColor: theme.colors.white,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pinIcon: {
    fontSize: 10,
  },
  location: {
    fontSize: 11,
    color: theme.colors.textMuted,
    flex: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 4,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  metaText: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 6,
  },
  originalPrice: {
    fontSize: 12,
    color: theme.colors.textMuted,
    textDecorationLine: 'line-through',
  },
  price: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
});
