import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';

type IconType = 'star' | 'hotel' | 'card' | 'pin' | 'badge' | 'people' | 'currency' | 'chart';

const BOXES: Array<Array<{ icon: IconType; title: string }>> = [
  [
    { icon: 'star', title: '10,000+ happy travelers' },
    { icon: 'hotel', title: 'Hotel pickup included' },
  ],
  [
    { icon: 'card', title: 'Secure payment' },
  ],
  [
    { icon: 'badge', title: 'Verified Tour Operators' },
    { icon: 'people', title: 'Professional Guides & Drivers' },
  ],
  [
    { icon: 'currency', title: 'Transparent Pricing' },
    { icon: 'chart', title: 'Secure Online Payments' },
  ],
];

function Icon({ type }: { type: IconType }) {
  const size = 20;
  const amber = theme.colors.amber || '#f59e0b';
  const slate = theme.colors.slate || '#475569';
  const indigo = theme.colors.indigo || '#4f46e5';
  const common = { width: size, height: size };
  if (type === 'star')
    return (
      <View style={[common, iconStyles.centered]}>
        <Text style={{ fontSize: 16 }}>⭐</Text>
      </View>
    );
  if (type === 'hotel')
    return (
      <View style={[common, iconStyles.centered]}>
        <Text style={{ fontSize: 14, color: slate }}>🏨</Text>
      </View>
    );
  if (type === 'card')
    return (
      <View style={[common, iconStyles.centered]}>
        <Text style={{ fontSize: 14, color: slate }}>💳</Text>
      </View>
    );
  if (type === 'pin')
    return (
      <View style={[common, iconStyles.centered]}>
        <Text style={{ fontSize: 14, color: slate }}>📍</Text>
      </View>
    );
  if (type === 'badge')
    return (
      <View style={[common, iconStyles.centered]}>
        <Text style={{ fontSize: 14, color: indigo }}>🛡️</Text>
      </View>
    );
  if (type === 'people')
    return (
      <View style={[common, iconStyles.centered]}>
        <Text style={{ fontSize: 14, color: slate }}>👥</Text>
      </View>
    );
  if (type === 'currency')
    return (
      <View style={[common, iconStyles.centered]}>
        <Text style={{ fontSize: 14, color: slate }}>💰</Text>
      </View>
    );
  if (type === 'chart')
    return (
      <View style={[common, iconStyles.centered]}>
        <Text style={{ fontSize: 14, color: slate }}>📊</Text>
      </View>
    );
  return null;
}

const iconStyles = StyleSheet.create({
  centered: { justifyContent: 'center', alignItems: 'center' },
});

export default function TrustBar() {
  return (
    <View style={styles.section}>
      <View style={styles.grid}>
        {BOXES.map((items, boxIndex) => (
          <View key={boxIndex} style={styles.card}>
            {items.map((item, i) => (
              <View key={i} style={[styles.row, i === 0 && { marginBottom: 6 }]}>
                <Icon type={item.icon} />
                <Text style={styles.label} numberOfLines={2}>
                  {item.title}
                </Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: '#f8fafc',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    justifyContent: 'space-between',
  },
  card: {
    width: '48%',
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.text,
  },
});
