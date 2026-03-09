import React from 'react';
import { View, Text, StyleSheet, Linking } from 'react-native';
import { theme } from '@/constants/theme';

/**
 * Business & company information (same content as web footer).
 * Shown as a dedicated section for a professional look.
 */
export default function BusinessSection() {
  const openEmail = () => Linking.openURL('mailto:support@atockorea.com');

  return (
    <View style={styles.section}>
      <Text style={styles.title}>Company & Contact</Text>

      <View style={styles.block}>
        <Text style={styles.label}>Company</Text>
        <Text style={styles.value}>AtoC Korea (LLC)</Text>
        <Text style={styles.muted}>State: Wyoming, USA</Text>
        <Text style={styles.muted}>Registered address: 30 N Gould St, STE R, Sheridan, WY 82801, USA</Text>
        <Text style={styles.muted}>Industry: Travel agency</Text>
        <Text style={styles.desc}>
          Online booking and sales of tours for travelers to Korea. Licensed Korea-based platform.
        </Text>
      </View>

      <View style={styles.block}>
        <Text style={styles.label}>Address</Text>
        <Text style={styles.value}>302, 32, Doryeong-ro 7-gil, Jeju-si, Jeju-do</Text>
      </View>

      <View style={styles.block}>
        <Text style={styles.label}>Contact</Text>
        <Text style={styles.value}>+82 10 9780 8027</Text>
        <Text style={styles.link} onPress={openEmail}>
          support@atockorea.com
        </Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.legal}>Terms · Privacy · Refund Policy</Text>
        <Text style={styles.copyright}>© 2026 AtoC Korea. All rights reserved.</Text>
      </View>
    </View>
  );
}

const dark = {
  bg: '#111827',
  bgBorder: '#374151',
  title: '#ffffff',
  value: '#e5e7eb',
  muted: '#9ca3af',
  link: '#93c5fd',
};

const styles = StyleSheet.create({
  section: {
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: dark.bg,
    borderTopWidth: 1,
    borderTopColor: dark.bgBorder,
  },
  title: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: dark.title,
    marginBottom: theme.spacing.md,
  },
  block: {
    marginBottom: theme.spacing.md,
  },
  label: {
    fontSize: theme.fontSize.xs,
    fontWeight: '700',
    color: dark.muted,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  value: {
    fontSize: theme.fontSize.sm,
    color: dark.value,
    fontWeight: '500',
  },
  muted: {
    fontSize: theme.fontSize.xs,
    color: dark.muted,
    marginTop: 2,
  },
  desc: {
    fontSize: theme.fontSize.xs,
    color: dark.muted,
    marginTop: 4,
    lineHeight: 18,
  },
  link: {
    fontSize: theme.fontSize.sm,
    color: dark.link,
    marginTop: 2,
  },
  footer: {
    marginTop: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: dark.bgBorder,
  },
  legal: {
    fontSize: theme.fontSize.xs,
    color: dark.muted,
  },
  copyright: {
    fontSize: theme.fontSize.xs,
    color: dark.muted,
    marginTop: 4,
  },
});
