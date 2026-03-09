import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  ActivityIndicator,
  StyleSheet,
  Pressable,
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { apiGet } from '@/api/client';
import { theme } from '@/constants/theme';
import type { Tour, PickupPoint } from '@/types/tour';
import { BASE_URL } from '@/api/client';

function nextDays(n: number) {
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

export default function TourDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [tour, setTour] = useState<Tour | null>(null);
  const [loading, setLoading] = useState(true);

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [guestCount, setGuestCount] = useState(1);
  const [selectedPickup, setSelectedPickup] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'deposit' | 'full'>('deposit');
  const [dateModalVisible, setDateModalVisible] = useState(false);

  useEffect(() => {
    if (!id) return;
    const path = `/api/tours/${encodeURIComponent(id)}`;
    apiGet<{ tour: Tour }>(path)
      .then((res) => setTour(res.tour))
      .catch(() => setTour(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!tour) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>Tour not found</Text>
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

  const firstImage = tour.images?.[0];
  const imageUri = tour.image
    ? (tour.image.startsWith('http') ? tour.image : `${BASE_URL.replace(/\/$/, '')}${tour.image.startsWith('/') ? '' : '/'}${tour.image}`)
    : typeof firstImage === 'string'
      ? (firstImage.startsWith('http') ? firstImage : `${BASE_URL.replace(/\/$/, '')}${firstImage.startsWith('/') ? '' : '/'}${firstImage}`)
      : firstImage && typeof firstImage === 'object' && 'url' in firstImage
        ? (firstImage.url.startsWith('http') ? firstImage.url : `${BASE_URL.replace(/\/$/, '')}${firstImage.url.startsWith('/') ? '' : '/'}${firstImage.url}`)
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

  return (
    <ScrollView style={styles.container}>
      {imageUri && <Image source={{ uri: imageUri }} style={styles.hero} resizeMode="cover" />}
      <View style={styles.body}>
        <Text style={styles.location}>{tour.city}</Text>
        <Text style={styles.title}>{tour.title}</Text>
        {tour.duration && <Text style={styles.meta}>Duration: {tour.duration}</Text>}
        <Text style={styles.price}>₩{tour.price.toLocaleString()}{priceType === 'person' ? ' / person' : ''}</Text>
        {(tour.overview || tour.description) && (
          <Text style={styles.desc}>{tour.overview || tour.description}</Text>
        )}

        <View style={styles.bookingCard}>
          <Text style={styles.bookingTitle}>Book this tour</Text>

          <Text style={styles.label}>Date *</Text>
          <Pressable style={styles.input} onPress={() => setDateModalVisible(true)}>
            <Text style={selectedDate ? styles.inputText : styles.inputPlaceholder}>
              {selectedDate ? selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'Select date'}
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
                        {d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
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
                    <Text style={[styles.pickupChipText, selectedPickup === p.id && styles.pickupChipTextSelected]} numberOfLines={1}>{p.name}</Text>
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
              <Text style={[styles.paymentBtnText, paymentMethod === 'deposit' && styles.paymentBtnTextSelected]}>Deposit (₩{depositAmountKRW.toLocaleString()})</Text>
              <Text style={styles.paymentBtnSub}>Balance on site</Text>
            </Pressable>
            <Pressable
              style={[styles.paymentBtn, paymentMethod === 'full' && styles.paymentBtnSelected]}
              onPress={() => setPaymentMethod('full')}
            >
              <Text style={[styles.paymentBtnText, paymentMethod === 'full' && styles.paymentBtnTextSelected]}>Full (₩{totalPrice.toLocaleString()})</Text>
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
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  error: { fontSize: theme.fontSize.base, color: theme.colors.textMuted },
  hero: { width: '100%', height: 220 },
  body: { padding: theme.spacing.md },
  location: { fontSize: theme.fontSize.sm, color: theme.colors.textMuted },
  title: { fontSize: theme.fontSize.xl, fontWeight: '700', color: theme.colors.text, marginTop: 4 },
  meta: { fontSize: theme.fontSize.sm, color: theme.colors.textMuted, marginTop: 4 },
  price: { fontSize: theme.fontSize.lg, fontWeight: '700', color: theme.colors.primary, marginTop: 8 },
  desc: { fontSize: theme.fontSize.sm, color: theme.colors.text, marginTop: 12, lineHeight: 22 },

  bookingCard: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
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
