import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Linking } from 'react-native';
import { apiPost, apiGet, BASE_URL } from '@/api/client';
import { theme } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';

interface CustomerInfo {
  name: string;
  phone: string;
  email: string;
  preferredChatApp: string;
  chatAppContact: string;
}

const CHAT_APPS = [
  { value: 'kakao', label: 'KakaoTalk' },
  { value: 'line', label: 'LINE' },
  { value: 'wechat', label: 'WeChat' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'other', label: 'Other' },
];

export default function CheckoutScreen() {
  const params = useLocalSearchParams<{
    id: string;
    date: string;
    guests: string;
    pickup: string;
    paymentMethod: string;
    totalPrice: string;
  }>();
  const router = useRouter();
  const { session, profile } = useAuth();

  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>({
    name: '',
    phone: '',
    email: '',
    preferredChatApp: '',
    chatAppContact: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof CustomerInfo, string>>>({});
  const [isProcessing, setIsProcessing] = useState(false);

  const tourId = params.id;
  const date = params.date;
  const guests = parseInt(params.guests || '1', 10);
  const pickup = params.pickup || null;
  const totalPrice = parseFloat(params.totalPrice || '0');

  // Prefill from auth profile when logged in (same as web)
  useEffect(() => {
    if (!session?.user) return;
    const name = profile?.full_name ?? (session.user.user_metadata?.full_name as string) ?? '';
    const email = session.user.email ?? '';
    const phone = profile?.phone ?? '';
    if (!name && !email) return;
    setCustomerInfo((prev) => ({
      ...prev,
      name: prev.name || name || '',
      email: prev.email || email || '',
      phone: prev.phone || phone || '',
    }));
  }, [session?.user?.id, session?.user?.email, profile?.full_name, profile?.phone]);

  const validate = (): boolean => {
    const name = customerInfo.name.trim();
    const phone = customerInfo.phone.trim();
    const email = customerInfo.email.trim();
    const newErrors: Partial<Record<keyof CustomerInfo, string>> = {};

    if (!name) newErrors.name = 'Please enter full name';
    else if (name.length < 2) newErrors.name = 'Name must be at least 2 characters';
    else if (name.length > 100) newErrors.name = 'Name too long';

    if (!phone) newErrors.phone = 'Please enter phone';
    else {
      const digits = phone.replace(/\D/g, '');
      if (digits.length < 8) newErrors.phone = 'Phone must have at least 8 digits';
      else if (digits.length > 15) newErrors.phone = 'Phone too long';
    }

    if (!email) newErrors.email = 'Please enter email';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = 'Invalid email';

    if (!customerInfo.preferredChatApp.trim()) newErrors.preferredChatApp = 'Please select preferred chat app';
    if (!customerInfo.chatAppContact.trim()) newErrors.chatAppContact = 'Please enter your chat app ID or link';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePayment = async () => {
    if (!validate()) return;
    setIsProcessing(true);

    try {
      const bookingPayload = {
        tourId: tourId,
        bookingDate: date,
        numberOfGuests: guests,
        pickupPointId: pickup || null,
        finalPrice: totalPrice,
        paymentMethod: 'full',
        specialRequests: JSON.stringify({
          preferredChatApp: customerInfo.preferredChatApp,
          chatAppContact: customerInfo.chatAppContact,
        }),
        customerInfo: {
          name: customerInfo.name.trim(),
          email: customerInfo.email.trim(),
          phone: customerInfo.phone.trim(),
          preferredChatApp: customerInfo.preferredChatApp,
          chatAppContact: customerInfo.chatAppContact,
        },
      };

      const token = session?.access_token ?? null;
      const bookingRes = await fetch(`${BASE_URL.replace(/\/$/, '')}/api/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(bookingPayload),
      });

      const bookingData = await bookingRes.json().catch(() => ({}));
      if (!bookingRes.ok) {
        const msg = bookingData?.message || bookingData?.error || bookingData?.details || 'Failed to create booking';
        throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
      }

      const bookingId = bookingData.booking?.id;
      if (!bookingId) throw new Error('Booking created but no ID returned');

      const stripeRes = await fetch(`${BASE_URL.replace(/\/$/, '')}/api/stripe/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: totalPrice,
          currency: 'krw',
          bookingId,
          bookingData: {
            customerInfo: {
              name: customerInfo.name.trim(),
              email: customerInfo.email.trim(),
              phone: customerInfo.phone.trim(),
              preferredChatApp: customerInfo.preferredChatApp,
              chatAppContact: customerInfo.chatAppContact,
            },
          },
        }),
      });

      const stripeData = await stripeRes.json().catch(() => ({}));

      if (stripeRes.ok && stripeData.url) {
        await Linking.openURL(stripeData.url);
        Alert.alert(
          'Payment opened',
          'Complete payment in your browser. You can return to the app after finishing.',
          [{ text: 'OK' }]
        );
        setIsProcessing(false);
        return;
      }

      if (!stripeRes.ok) {
        const errMsg = stripeData?.error || 'Payment could not be started.';
        Alert.alert('Payment', `${errMsg} Your booking has been saved. Please try again or contact support.`);
      } else {
        Alert.alert('Payment', 'Payment processing will be available soon. Your booking has been saved.');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Something went wrong. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const setField = (field: keyof CustomerInfo, value: string) => {
    if (field === 'phone') value = value.replace(/[^0-9+]/g, '');
    setCustomerInfo((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const dateStr = date ? new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '';

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Customer information</Text>
        <Text style={styles.required}>Required *</Text>

        <Text style={styles.label}>Full name *</Text>
        <TextInput
          style={[styles.input, errors.name && styles.inputError]}
          value={customerInfo.name}
          onChangeText={(v) => setField('name', v)}
          placeholder="Enter full name"
          placeholderTextColor="#999"
          autoCapitalize="words"
        />
        {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}

        <Text style={styles.label}>Phone *</Text>
        <TextInput
          style={[styles.input, errors.phone && styles.inputError]}
          value={customerInfo.phone}
          onChangeText={(v) => setField('phone', v)}
          placeholder="Enter phone"
          placeholderTextColor="#999"
          keyboardType="phone-pad"
        />
        {errors.phone ? <Text style={styles.errorText}>{errors.phone}</Text> : null}

        <Text style={styles.label}>Email *</Text>
        <TextInput
          style={[styles.input, errors.email && styles.inputError]}
          value={customerInfo.email}
          onChangeText={(v) => setField('email', v)}
          placeholder="Enter email"
          placeholderTextColor="#999"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}

        <Text style={styles.label}>Preferred chat app *</Text>
        <View style={styles.chatRow}>
          {CHAT_APPS.map((app) => (
            <Pressable
              key={app.value}
              style={[styles.chatChip, customerInfo.preferredChatApp === app.value && styles.chatChipSelected]}
              onPress={() => setField('preferredChatApp', app.value)}
            >
              <Text style={[styles.chatChipText, customerInfo.preferredChatApp === app.value && styles.chatChipTextSelected]}>{app.label}</Text>
            </Pressable>
          ))}
        </View>
        {errors.preferredChatApp ? <Text style={styles.errorText}>{errors.preferredChatApp}</Text> : null}

        <Text style={styles.label}>Chat app ID or link *</Text>
        <TextInput
          style={[styles.input, errors.chatAppContact && styles.inputError]}
          value={customerInfo.chatAppContact}
          onChangeText={(v) => setField('chatAppContact', v)}
          placeholder={customerInfo.preferredChatApp === 'line' ? 'Enter LINE link' : 'Enter your chat ID'}
          placeholderTextColor="#999"
          autoCapitalize="none"
        />
        {errors.chatAppContact ? <Text style={styles.errorText}>{errors.chatAppContact}</Text> : null}

        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>Booking summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Date</Text>
            <Text style={styles.summaryValue}>{dateStr}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Guests</Text>
            <Text style={styles.summaryValue}>{guests}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Payment</Text>
            <Text style={styles.summaryValue}>Full payment</Text>
          </View>
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>₩{totalPrice.toLocaleString()}</Text>
          </View>
        </View>

        <Pressable
          style={[styles.payBtn, isProcessing && styles.payBtnDisabled]}
          onPress={handlePayment}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.payBtnText}>Complete booking</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.md, paddingBottom: 32 },
  title: { fontSize: 18, fontWeight: '600', color: theme.colors.text, marginBottom: 4 },
  required: { fontSize: 12, color: theme.colors.textMuted, marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '500', color: theme.colors.text, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    fontSize: 15,
    color: theme.colors.text,
    marginBottom: 12,
  },
  inputError: { borderColor: '#dc2626', backgroundColor: 'rgba(220,38,38,0.05)' },
  errorText: { fontSize: 12, color: '#dc2626', marginTop: -6, marginBottom: 12 },
  chatRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chatChip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#eee' },
  chatChipSelected: { borderColor: theme.colors.primary, backgroundColor: 'rgba(37,99,235,0.1)' },
  chatChipText: { fontSize: 13, color: theme.colors.text },
  chatChipTextSelected: { color: theme.colors.primary, fontWeight: '500' },

  summary: { marginTop: 24, padding: 16, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' },
  summaryTitle: { fontSize: 16, fontWeight: '600', color: theme.colors.text, marginBottom: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel: { fontSize: 14, color: theme.colors.textMuted },
  summaryValue: { fontSize: 14, fontWeight: '500', color: theme.colors.text },
  totalRow: { marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#eee' },
  totalLabel: { fontSize: 16, fontWeight: '600', color: theme.colors.text },
  totalValue: { fontSize: 18, fontWeight: '700', color: theme.colors.primary },

  payBtn: { marginTop: 24, backgroundColor: theme.colors.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  payBtnDisabled: { opacity: 0.7 },
  payBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
