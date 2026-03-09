/**
 * Cart – reads from Supabase via GET /api/cart (cart_items + tours).
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Image,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { theme } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { apiGet, apiDelete } from '@/api/client';

interface TourRef {
  id: string;
  title: string;
  city: string;
  price: number;
  original_price?: number | null;
  price_type: string;
  image_url: string | null;
  images?: unknown;
  duration?: string | null;
}

interface PickupRef {
  id: string;
  name: string;
  address: string;
}

interface CartItem {
  id: string;
  tour_id: string;
  booking_date: string;
  number_of_guests: number;
  unit_price: number;
  total_price: number;
  tours: TourRef | null;
  pickup_points: PickupRef | null;
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatPrice(n: number) {
  return `₩${Number(n).toLocaleString()}`;
}

export default function CartScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const token = session?.access_token ?? null;

  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const fetchCart = useCallback(async () => {
    if (!token) {
      setItems([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const data = await apiGet<{ cartItems: CartItem[] }>('/api/cart', undefined, token);
      setItems(data.cartItems || []);
      setError(null);
    } catch (e) {
      setItems([]);
      setError(e instanceof Error ? e.message : 'Failed to load cart.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  const handleRemove = useCallback(
    async (itemId: string) => {
      if (!token) return;
      Alert.alert('Remove item', 'Remove this tour from your cart?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setRemovingId(itemId);
            try {
              await apiDelete(`/api/cart/${itemId}`, token);
              setItems((prev) => prev.filter((i) => i.id !== itemId));
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : 'Failed to remove.');
            } finally {
              setRemovingId(null);
            }
          },
        },
      ]);
    },
    [token]
  );

  if (!session) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Cart</Text>
          <Text style={styles.subtitle}>Sign in to see your cart.</Text>
          <Pressable style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]} onPress={() => router.push('/(tabs)/profile')}>
            <Text style={styles.btnText}>Sign in</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchCart(); }} />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Cart</Text>
          <Text style={styles.subtitle}>Add or remove tours here.</Text>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {items.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Your cart is empty</Text>
            <Text style={styles.emptySubtitle}>Add tours and they will appear here.</Text>
            <Pressable style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]} onPress={() => router.push('/(tabs)/tours')}>
              <Text style={styles.btnText}>Browse tours</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {items.map((item) => (
              <View key={item.id} style={styles.itemCard}>
                {item.tours?.image_url ? (
                  <Image source={{ uri: item.tours.image_url }} style={styles.itemImage} resizeMode="cover" />
                ) : (
                  <View style={[styles.itemImage, styles.itemImagePlaceholder]} />
                )}
                <View style={styles.itemBody}>
                  <Text style={styles.itemTitle} numberOfLines={2}>{item.tours?.title ?? 'Tour'}</Text>
                  <Text style={styles.itemMeta}>{item.tours?.city ?? ''} · {formatDate(item.booking_date)}</Text>
                  <Text style={styles.itemMeta}>{item.number_of_guests} guest{item.number_of_guests !== 1 ? 's' : ''}</Text>
                  <Text style={styles.itemPrice}>{formatPrice(item.total_price)}</Text>
                  <Pressable
                    style={[styles.removeBtn, removingId === item.id && styles.removeBtnDisabled]}
                    onPress={() => handleRemove(item.id)}
                    disabled={removingId === item.id}
                  >
                    {removingId === item.id ? (
                      <ActivityIndicator size="small" color="#dc2626" />
                    ) : (
                      <Text style={styles.removeBtnText}>Remove</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            ))}
            <Pressable
              style={({ pressed }) => [styles.checkoutBtn, pressed && styles.btnPressed]}
              onPress={() => {
                const first = items[0];
                if (!first?.tour_id) return;
                const deposit = 10000;
                router.push({
                  pathname: '/tour/[id]/checkout',
                  params: {
                    id: first.tour_id,
                    date: first.booking_date,
                    guests: String(first.number_of_guests),
                    pickup: '',
                    paymentMethod: 'deposit',
                    totalPrice: String(first.total_price),
                    depositAmountKRW: String(deposit),
                    balanceAmountKRW: String(Math.max(0, first.total_price - deposit)),
                  },
                });
              }}
            >
              <Text style={styles.btnText}>Checkout</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { flex: 1 },
  scrollContent: { padding: theme.spacing.md, paddingBottom: theme.spacing.xl },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { marginBottom: theme.spacing.md },
  title: { fontSize: theme.fontSize.xl, fontWeight: '700', color: theme.colors.text },
  subtitle: { fontSize: theme.fontSize.sm, color: theme.colors.textMuted, marginTop: 4 },
  errorText: { fontSize: 14, color: '#dc2626', marginBottom: theme.spacing.sm },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  emptyCard: {
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  emptyTitle: { fontSize: theme.fontSize.lg, fontWeight: '600', color: theme.colors.text },
  emptySubtitle: { fontSize: theme.fontSize.sm, color: theme.colors.textMuted, marginTop: 8, marginBottom: theme.spacing.md },
  itemCard: {
    flexDirection: 'row',
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  itemImage: { width: 100, height: 100 },
  itemImagePlaceholder: { backgroundColor: theme.colors.border },
  itemBody: { flex: 1, padding: theme.spacing.sm },
  itemTitle: { fontSize: theme.fontSize.base, fontWeight: '600', color: theme.colors.text },
  itemMeta: { fontSize: theme.fontSize.xs, color: theme.colors.textMuted, marginTop: 2 },
  itemPrice: { fontSize: theme.fontSize.sm, fontWeight: '700', color: theme.colors.primary, marginTop: 6 },
  removeBtn: { alignSelf: 'flex-start', marginTop: 8 },
  removeBtnDisabled: { opacity: 0.6 },
  removeBtnText: { fontSize: 14, color: '#dc2626', fontWeight: '600' },
  btn: { backgroundColor: theme.colors.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  btnSecondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.colors.border },
  btnPressed: { opacity: 0.9 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  btnTextSecondary: { color: theme.colors.text, fontWeight: '600', fontSize: 16 },
  checkoutBtn: { backgroundColor: theme.colors.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: theme.spacing.md },
});
