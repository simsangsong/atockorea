import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { theme } from '@/constants/theme';
import Logo from '@/components/Logo';

type Currency = 'KRW' | 'USD';
type Language = 'en' | 'ko';

export default function AppHeader() {
  const router = useRouter();
  const [currency, setCurrency] = useState<Currency>('KRW');
  const [language, setLanguage] = useState<Language>('en');

  const toggleCurrency = () => setCurrency((c) => (c === 'KRW' ? 'USD' : 'KRW'));
  const toggleLanguage = () => setLanguage((l) => (l === 'en' ? 'ko' : 'en'));

  return (
    <View style={styles.header}>
      <Pressable onPress={() => router.push('/(tabs)')} style={styles.logoWrap}>
        <Logo size="sm" />
      </Pressable>
      <View style={styles.actions}>
        <Pressable onPress={toggleLanguage} style={styles.actionBtn}>
          <Text style={styles.actionText}>{language === 'en' ? 'EN' : '한국어'}</Text>
        </Pressable>
        <Pressable onPress={toggleCurrency} style={styles.actionBtn}>
          <Text style={styles.actionText}>{currency}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 52,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  logoWrap: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text,
  },
});
