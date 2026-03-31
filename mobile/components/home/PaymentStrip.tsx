import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { theme } from '@/constants/theme';

const CARD_MARGIN_H = theme.spacing.md;
const CARD_PADDING = theme.spacing.sm + 2;

export default function PaymentStrip() {
  return (
    <View style={styles.outer}>
      <View style={styles.card}>
        <Text style={styles.benefit} numberOfLines={2}>
          Pay the full tour price securely online when you book. Free cancellation until 24h before departure.
        </Text>
        <View style={styles.badges}>
          <View style={[styles.badge, styles.badgeDeposit]}>
            <Text style={styles.badgeText}>Full payment online</Text>
          </View>
          <View style={[styles.badge, styles.badgeFull]}>
            <Text style={styles.badgeText}>Full Payment Online</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    paddingHorizontal: CARD_MARGIN_H,
    paddingTop: theme.spacing.xs,
    paddingBottom: theme.spacing.md,
  },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    paddingVertical: CARD_PADDING,
    paddingHorizontal: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  benefit: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
    lineHeight: 18,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  badge: {
    paddingHorizontal: theme.spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: theme.radius.sm,
  },
  badgeDeposit: {
    backgroundColor: '#dbeafe',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.25)',
  },
  badgeFull: {
    backgroundColor: '#e0e7ff',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.25)',
  },
  badgeText: {
    fontSize: theme.fontSize.xs,
    fontWeight: '600',
    color: theme.colors.text,
  },
});
