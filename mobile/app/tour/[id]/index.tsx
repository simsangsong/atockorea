/**
 * Tour detail – same data as web (app/tour/[id]/page.tsx).
 * Fetches GET /api/tours/[id]?locale=…, shows gallery, overview, itinerary, FAQ, meeting point (Open in Maps), reviews, booking.
 */
import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  ActivityIndicator,
  StyleSheet,
  Pressable,
  Modal,
  Linking,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { apiGet } from '@/api/client';
import { theme } from '@/constants/theme';
import type { Tour, PickupPoint, Faq, ItineraryDetail } from '@/types/tour';
import { BASE_URL } from '@/api/client';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_HEIGHT = 260;
const GALLERY_ITEM_SIZE = 100;

// ——— Data transform (same as web) ———
function removeRoutes(text: string | null | undefined): string {
  if (!text) return '';
  let cleaned = String(text);
  const routePatterns = [
    /\*\*Recommended Routes?:\*\*[\s\S]*/i,
    /\*\*추천 루트:\*\*[\s\S]*/i,
    /Recommended Routes?:[\s\S]*/i,
    /추천 루트:[\s\S]*/i,
    /\*\*(East|West|South) Route:\*\*[\s\S]*/i,
    /\*\*동부 루트:[\s\S]*/i,
    /\*\*서부 루트:[\s\S]*/i,
    /\*\*남부 루트:[\s\S]*/i,
  ];
  for (const pattern of routePatterns) {
    const match = cleaned.search(pattern);
    if (match !== -1) {
      cleaned = cleaned.substring(0, match).trim();
      break;
    }
  }
  return cleaned;
}

function transformImages(gallery: any[]): Array<{ url: string; title: string; description: string }> {
  if (!gallery?.length) return [];
  return gallery.map((img, index) => {
    if (typeof img === 'string') return { url: img, title: `Image ${index + 1}`, description: '' };
    return {
      url: (img as any).url || img,
      title: (img as any).title || `Image ${index + 1}`,
      description: (img as any).description || '',
    };
  });
}

function nextDays(n: number): Date[] {
  const out: Date[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < n; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    out.push(d);
  }
  return out;
}

const DEPOSIT_KRW = 10000;

function hasValidCoords(lat?: number, lng?: number): boolean {
  const la = Number(lat);
  const ln = Number(lng);
  if (Number.isNaN(la) || Number.isNaN(ln)) return false;
  if (la === 0 && ln === 0) return false;
  return la >= -90 && la <= 90 && ln >= -180 && ln <= 180;
}

function openInMaps(point: PickupPoint) {
  const lat = point.lat;
  const lng = point.lng;
  const url =
    lat != null && lng != null && hasValidCoords(lat, lng)
      ? `https://www.google.com/maps?q=${lat},${lng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(point.address || point.name)}`;
  Linking.openURL(url);
}

interface ReviewItem {
  id: string;
  tour_id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  created_at: string;
  user_profiles?: { full_name: string | null } | null;
}

export default function TourDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [tour, setTour] = useState<Tour | null>(null);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [guestCount, setGuestCount] = useState(1);
  const [selectedPickup, setSelectedPickup] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'deposit' | 'full'>('deposit');
  const [dateModalVisible, setDateModalVisible] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const locale = 'en';

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    const path = `/api/tours/${encodeURIComponent(id)}?locale=${locale}`;
    apiGet<{ tour: Tour }>(path)
      .then((res) => {
        const raw = res.tour;
        const gallery = raw.gallery_images || (raw.images as any[]) || [];
        const transformed: Tour = {
          ...raw,
          title: removeRoutes(raw.title),
          tagline: removeRoutes(raw.tagline || (raw as any).subtitle),
          overview: removeRoutes(raw.overview || raw.description),
          images: transformImages(Array.isArray(gallery) ? gallery : []),
          quickFacts: raw.quickFacts || [
            raw.groupSize ? `Group size: ${raw.groupSize}` : '',
            raw.difficulty ? `Difficulty: ${raw.difficulty}` : '',
            raw.duration ? `Duration: ${raw.duration}` : '',
          ].filter(Boolean),
          itinerary: raw.itinerary || [],
          itineraryDetails: raw.itineraryDetails,
          inclusions: raw.inclusions || [],
          exclusions: raw.exclusions || [],
          pickupPoints: raw.pickupPoints || raw.pickup_points || [],
          highlights: raw.highlights || [],
          faqs: raw.faqs || [],
        };
        setTour(transformed);
      })
      .catch(() => {
        setTour(null);
        setError('Tour not found');
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setReviewsLoading(true);
    apiGet<{ reviews: ReviewItem[] }>(`/api/reviews?tourId=${encodeURIComponent(id)}&limit=20`)
      .then((res) => setReviews(res.reviews || []))
      .catch(() => setReviews([]))
      .finally(() => setReviewsLoading(false));
  }, [id]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (error || !tour) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error || 'Tour not found'}</Text>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Back to list</Text>
        </Pressable>
      </View>
    );
  }

  const pickups: PickupPoint[] = tour.pickupPoints || tour.pickup_points || [];
  const priceType = tour.priceType || 'person';
  const basePrice = tour.price;
  const totalPrice = priceType === 'person' ? basePrice * guestCount : basePrice;
  const depositAmountKRW = DEPOSIT_KRW;
  const balanceAmountKRW = totalPrice - depositAmountKRW;
  const paymentAmount = paymentMethod === 'deposit' ? depositAmountKRW : totalPrice;

  const images = Array.isArray(tour.images) ? tour.images : [];
  const firstImg = images[0];
  const firstUrl =
    firstImg && typeof firstImg === 'object' && 'url' in firstImg
      ? (firstImg as any).url
      : typeof firstImg === 'string'
        ? firstImg
        : tour.image;
  const imageUri = firstUrl
    ? firstUrl.startsWith('http')
      ? firstUrl
      : `${BASE_URL.replace(/\/$/, '')}${firstUrl.startsWith('/') ? '' : '/'}${firstUrl}`
    : null;

  const goToCheckout = () => {
    if (!selectedDate) return;
    router.push({
      pathname: '/tour/[id]/checkout',
      params: {
        id: String(tour.id),
        date: selectedDate.toISOString(),
        guests: String(guestCount),
        pickup: selectedPickup || '',
        paymentMethod,
        totalPrice: String(totalPrice),
        depositAmountKRW: String(depositAmountKRW),
        balanceAmountKRW: String(balanceAmountKRW),
      },
    });
  };

  const days = nextDays(90);
  const rating = tour.rating ?? 0;
  const reviewCount = tour.reviewCount ?? tour.review_count ?? 0;

  const keyInfoItems = useMemo(() => {
    if (!tour) return [];
    const kw = (tour as any).keywords;
    if (kw && Array.isArray(kw) && kw.length > 0) {
      return kw
        .map((k: string) => {
          const parts = String(k).split(':').map((p: string) => p.trim());
          const label = parts[0] || '';
          const value = parts.length > 1 ? parts.slice(1).join(':').trim() : k;
          const lower = label.toLowerCase();
          if (lower.includes('duration') || lower.includes('time')) return null;
          if (!value) return null;
          return { label, value };
        })
        .filter(Boolean) as { label: string; value: string }[];
    }
    const out: { label: string; value: string }[] = [];
    if (tour.difficulty) out.push({ label: 'Difficulty', value: tour.difficulty });
    if (tour.groupSize) out.push({ label: 'Group size', value: tour.groupSize });
    return out;
  }, [tour]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Hero */}
      {imageUri && (
        <Image source={{ uri: imageUri }} style={styles.hero} resizeMode="cover" />
      )}

      {/* Title & rating */}
      <View style={styles.card}>
        <Text style={styles.location}>{tour.city}</Text>
        <Text style={styles.title}>{tour.title}</Text>
        <View style={styles.ratingRow}>
          <Text style={styles.rating}>★ {rating.toFixed(1)}</Text>
          <Text style={styles.meta}>{reviewCount} reviews</Text>
          {tour.badges?.[0] && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{tour.badges[0]}</Text>
            </View>
          )}
        </View>
        {tour.duration ? <Text style={styles.meta}>Duration: {tour.duration}</Text> : null}
        <Text style={styles.price}>
          ₩{tour.price.toLocaleString()}
          {priceType === 'person' ? ' / person' : ''}
        </Text>
        {tour.originalPrice != null && tour.originalPrice > tour.price && (
          <Text style={styles.originalPrice}>₩{tour.originalPrice.toLocaleString()}</Text>
        )}
      </View>

      {/* Key info */}
      {keyInfoItems.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Key info</Text>
          {keyInfoItems.map((item, i) => (
            <View key={i} style={styles.keyInfoRow}>
              <Text style={styles.keyInfoLabel}>{item.label}</Text>
              <Text style={styles.keyInfoValue}>{item.value}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Gallery */}
      {images.length > 1 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Gallery</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.galleryScroll}>
            {images.map((img, i) => {
              const url = typeof img === 'object' && img && 'url' in img ? (img as any).url : String(img);
              const uri = url.startsWith('http') ? url : `${BASE_URL.replace(/\/$/, '')}${url.startsWith('/') ? '' : '/'}${url}`;
              return (
                <Pressable key={i} onPress={() => {}}>
                  <Image source={{ uri }} style={styles.galleryItem} resizeMode="cover" />
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Overview */}
      {(tour.overview || tour.description) && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.overview}>{tour.overview || tour.description}</Text>
        </View>
      )}

      {/* Itinerary */}
      {((tour.itineraryDetails && tour.itineraryDetails.length > 0) || (tour.itinerary && tour.itinerary.length > 0)) && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Itinerary</Text>
          {(tour.itineraryDetails?.length ? tour.itineraryDetails : tour.itinerary || []).map((item: any, i: number) => (
            <View key={i} style={styles.itineraryItem}>
              <Text style={styles.itineraryTime}>{item.time || item.title}</Text>
              <Text style={styles.itineraryActivity}>{item.activity || item.title}</Text>
              {(item.description || (item as any).description) && (
                <Text style={styles.itineraryDesc}>{item.description || (item as any).description}</Text>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Inclusions / Exclusions */}
      {((tour.inclusions && tour.inclusions.length > 0) || (tour.exclusions && tour.exclusions.length > 0)) && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>What's included</Text>
          {tour.inclusions && tour.inclusions.length > 0 && (
            <>
              <Text style={styles.includeSub}>Included</Text>
              {tour.inclusions.map((item, i) => (
                <Text key={i} style={styles.bullet}>• {typeof item === 'string' ? item : (item as any).text}</Text>
              ))}
            </>
          )}
          {tour.exclusions && tour.exclusions.length > 0 && (
            <>
              <Text style={[styles.includeSub, { marginTop: 12 }]}>Not included</Text>
              {tour.exclusions.map((item, i) => (
                <Text key={i} style={styles.bullet}>• {typeof item === 'string' ? item : (item as any).text}</Text>
              ))}
            </>
          )}
        </View>
      )}

      {/* Highlights */}
      {tour.highlights && tour.highlights.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Highlights</Text>
          {tour.highlights.map((h, i) => (
            <Text key={i} style={styles.bullet}>• {h}</Text>
          ))}
        </View>
      )}

      {/* FAQ */}
      {tour.faqs && tour.faqs.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>FAQ</Text>
          {tour.faqs.map((faq, i) => (
            <Pressable
              key={i}
              style={styles.faqRow}
              onPress={() => setOpenFaqIndex(openFaqIndex === i ? null : i)}
            >
              <Text style={styles.faqQuestion}>{faq.question}</Text>
              {openFaqIndex === i && <Text style={styles.faqAnswer}>{faq.answer}</Text>}
            </Pressable>
          ))}
        </View>
      )}

      {/* Child eligibility */}
      {tour.childEligibility && tour.childEligibility.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Child eligibility</Text>
          {tour.childEligibility.map((r, i) => (
            <Text key={i} style={styles.bullet}>• {r.text || JSON.stringify(r)}</Text>
          ))}
        </View>
      )}

      {/* Suggested to bring */}
      {tour.suggestedToBring && tour.suggestedToBring.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Suggested to bring</Text>
          {tour.suggestedToBring.filter(Boolean).map((item, i) => (
            <Text key={i} style={styles.bullet}>• {item}</Text>
          ))}
        </View>
      )}

      {/* Meeting point / Pickup */}
      {pickups.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Meeting point & pickup</Text>
          {pickups.map((p) => (
            <View key={p.id} style={styles.pickupRow}>
              <View style={styles.pickupInfo}>
                <Text style={styles.pickupName}>{p.name}</Text>
                {p.address ? <Text style={styles.pickupAddress}>{p.address}</Text> : null}
              </View>
              <Pressable style={styles.directionsBtn} onPress={() => openInMaps(p)}>
                <Text style={styles.directionsBtnText}>Open in Maps</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {/* Reviews */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Reviews {reviews.length > 0 ? `(${reviews.length})` : ''}</Text>
        {reviewsLoading ? (
          <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginVertical: 12 }} />
        ) : reviews.length === 0 ? (
          <Text style={styles.muted}>No reviews yet for this tour.</Text>
        ) : (
          reviews.slice(0, 5).map((r) => (
            <View key={r.id} style={styles.reviewRow}>
              <Text style={styles.reviewStars}>★ {r.rating}</Text>
              <Text style={styles.reviewComment}>{r.comment || r.title || '—'}</Text>
              <Text style={styles.reviewMeta}>
                {r.user_profiles?.full_name || 'Anonymous'} • {new Date(r.created_at).toLocaleDateString()}
              </Text>
            </View>
          ))
        )}
      </View>

      {/* Booking card */}
      <View style={styles.bookingCard}>
        <Text style={styles.bookingTitle}>Book this tour</Text>

        <Text style={styles.label}>Date *</Text>
        <Pressable style={styles.input} onPress={() => setDateModalVisible(true)}>
          <Text style={selectedDate ? styles.inputText : styles.inputPlaceholder}>
            {selectedDate
              ? selectedDate.toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : 'Select date'}
          </Text>
        </Pressable>
        <Modal visible={dateModalVisible} transparent animationType="slide">
          <Pressable style={styles.modalOverlay} onPress={() => setDateModalVisible(false)}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Select date</Text>
              <ScrollView style={styles.dateList}>
                {days.map((d) => (
                  <Pressable
                    key={d.getTime()}
                    style={[styles.dateRow, selectedDate?.getTime() === d.getTime() && styles.dateRowSelected]}
                    onPress={() => {
                      setSelectedDate(d);
                      setDateModalVisible(false);
                    }}
                  >
                    <Text style={styles.dateRowText}>
                      {d.toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Pressable style={styles.modalClose} onPress={() => setDateModalVisible(false)}>
                <Text style={styles.modalCloseText}>Close</Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>

        <Text style={styles.label}>Guests *</Text>
        <View style={styles.guestRow}>
          <Pressable
            style={[styles.guestBtn, guestCount <= 1 && styles.guestBtnDisabled]}
            onPress={() => setGuestCount((c) => Math.max(1, c - 1))}
            disabled={guestCount <= 1}
          >
            <Text style={styles.guestBtnText}>−</Text>
          </Pressable>
          <Text style={styles.guestCount}>{guestCount}</Text>
          <Pressable style={styles.guestBtn} onPress={() => setGuestCount((c) => c + 1)}>
            <Text style={styles.guestBtnText}>+</Text>
          </Pressable>
        </View>

        {pickups.length > 0 && (
          <>
            <Text style={styles.label}>Pickup location</Text>
            <View style={styles.pickupWrap}>
              {pickups.map((p) => (
                <Pressable
                  key={p.id}
                  style={[styles.pickupChip, selectedPickup === p.id && styles.pickupChipSelected]}
                  onPress={() => setSelectedPickup(selectedPickup === p.id ? null : p.id)}
                >
                  <Text
                    style={[styles.pickupChipText, selectedPickup === p.id && styles.pickupChipTextSelected]}
                    numberOfLines={1}
                  >
                    {p.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        <Text style={styles.label}>Payment</Text>
        <View style={styles.paymentRow}>
          <Pressable
            style={[styles.paymentBtn, paymentMethod === 'deposit' && styles.paymentBtnSelected]}
            onPress={() => setPaymentMethod('deposit')}
          >
            <Text style={[styles.paymentBtnText, paymentMethod === 'deposit' && styles.paymentBtnTextSelected]}>
              Deposit (₩{depositAmountKRW.toLocaleString()})
            </Text>
            <Text style={styles.paymentBtnSub}>Balance on site</Text>
          </Pressable>
          <Pressable
            style={[styles.paymentBtn, paymentMethod === 'full' && styles.paymentBtnSelected]}
            onPress={() => setPaymentMethod('full')}
          >
            <Text style={[styles.paymentBtnText, paymentMethod === 'full' && styles.paymentBtnTextSelected]}>
              Full (₩{totalPrice.toLocaleString()})
            </Text>
          </Pressable>
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>₩{paymentAmount.toLocaleString()}</Text>
        </View>

        <Pressable
          style={({ pressed }) => [styles.continueBtn, pressed && styles.continueBtnPressed]}
          onPress={goToCheckout}
          disabled={!selectedDate}
        >
          <Text style={styles.continueBtnText}>Continue to checkout</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingBottom: theme.spacing.xl },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: theme.fontSize.base, color: theme.colors.textMuted, marginBottom: 12 },
  backBtn: { padding: 12, backgroundColor: theme.colors.primary },
  backBtnText: { color: '#fff', fontWeight: '600' },

  hero: { width: '100%', height: HERO_HEIGHT, backgroundColor: theme.colors.border },
  card: {
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  location: { fontSize: theme.fontSize.sm, color: theme.colors.textMuted },
  title: { fontSize: theme.fontSize.xl, fontWeight: '700', color: theme.colors.text, marginTop: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  rating: { fontSize: theme.fontSize.sm, fontWeight: '600', color: theme.colors.text },
  meta: { fontSize: theme.fontSize.sm, color: theme.colors.textMuted },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: '#f1f5f9' },
  badgeText: { fontSize: 11, color: theme.colors.slate },
  price: { fontSize: theme.fontSize.lg, fontWeight: '700', color: theme.colors.primary, marginTop: 8 },
  originalPrice: { fontSize: theme.fontSize.sm, color: theme.colors.textMuted, textDecorationLine: 'line-through', marginTop: 2 },

  sectionTitle: { fontSize: theme.fontSize.lg, fontWeight: '600', color: theme.colors.text, marginBottom: 12 },
  keyInfoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  keyInfoLabel: { fontSize: theme.fontSize.sm, color: theme.colors.textMuted },
  keyInfoValue: { fontSize: theme.fontSize.sm, color: theme.colors.text, fontWeight: '500' },

  galleryScroll: { marginHorizontal: -4 },
  galleryItem: { width: GALLERY_ITEM_SIZE, height: GALLERY_ITEM_SIZE, borderRadius: 8, marginRight: 8 },
  overview: { fontSize: theme.fontSize.sm, color: theme.colors.text, lineHeight: 22 },

  itineraryItem: { marginBottom: 12, paddingLeft: 8, borderLeftWidth: 3, borderLeftColor: theme.colors.primary },
  itineraryTime: { fontSize: 12, color: theme.colors.textMuted, fontWeight: '600' },
  itineraryActivity: { fontSize: theme.fontSize.sm, fontWeight: '500', color: theme.colors.text, marginTop: 2 },
  itineraryDesc: { fontSize: theme.fontSize.sm, color: theme.colors.textMuted, marginTop: 4 },

  includeSub: { fontSize: theme.fontSize.sm, fontWeight: '600', color: theme.colors.text },
  bullet: { fontSize: theme.fontSize.sm, color: theme.colors.text, marginBottom: 4 },

  faqRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  faqQuestion: { fontSize: theme.fontSize.sm, fontWeight: '500', color: theme.colors.text },
  faqAnswer: { fontSize: theme.fontSize.sm, color: theme.colors.textMuted, marginTop: 6 },

  pickupRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  pickupInfo: { flex: 1, marginRight: 8 },
  pickupName: { fontSize: theme.fontSize.sm, fontWeight: '600', color: theme.colors.text },
  pickupAddress: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  directionsBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: theme.colors.primary },
  directionsBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },

  reviewRow: { marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  reviewStars: { fontSize: theme.fontSize.sm, fontWeight: '600', color: theme.colors.amber },
  reviewComment: { fontSize: theme.fontSize.sm, color: theme.colors.text, marginTop: 4 },
  reviewMeta: { fontSize: 11, color: theme.colors.textMuted, marginTop: 4 },
  muted: { fontSize: theme.fontSize.sm, color: theme.colors.textMuted },

  bookingCard: {
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.lg,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  bookingTitle: { fontSize: 18, fontWeight: '600', color: theme.colors.text, marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '500', color: theme.colors.text, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  inputText: { fontSize: 15, color: theme.colors.text },
  inputPlaceholder: { fontSize: 15, color: '#999' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '70%', paddingBottom: 24 },
  modalTitle: { fontSize: 18, fontWeight: '600', padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  dateList: { maxHeight: 320 },
  dateRow: { paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  dateRowSelected: { backgroundColor: 'rgba(37,99,235,0.1)' },
  dateRowText: { fontSize: 15, color: theme.colors.text },
  modalClose: { marginTop: 8, padding: 16, alignItems: 'center' },
  modalCloseText: { fontSize: 16, color: theme.colors.primary, fontWeight: '500' },

  guestRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  guestBtn: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' },
  guestBtnDisabled: { opacity: 0.5 },
  guestBtnText: { fontSize: 20, color: theme.colors.text },
  guestCount: { fontSize: 16, fontWeight: '600', marginHorizontal: 16, minWidth: 24, textAlign: 'center' },

  pickupWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  pickupChip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#eee' },
  pickupChipSelected: { backgroundColor: 'rgba(37,99,235,0.15)', borderColor: theme.colors.primary },
  pickupChipText: { fontSize: 13, color: theme.colors.text },
  pickupChipTextSelected: { color: theme.colors.primary, fontWeight: '500' },

  paymentRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  paymentBtn: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: '#ddd', alignItems: 'center' },
  paymentBtnSelected: { borderColor: theme.colors.primary, backgroundColor: 'rgba(37,99,235,0.08)' },
  paymentBtnText: { fontSize: 14, fontWeight: '500', color: theme.colors.text },
  paymentBtnTextSelected: { color: theme.colors.primary },
  paymentBtnSub: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },

  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: '#eee', marginBottom: 16 },
  totalLabel: { fontSize: 16, fontWeight: '600', color: theme.colors.text },
  totalValue: { fontSize: 18, fontWeight: '700', color: theme.colors.primary },

  continueBtn: { backgroundColor: theme.colors.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  continueBtnPressed: { opacity: 0.9 },
  continueBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
