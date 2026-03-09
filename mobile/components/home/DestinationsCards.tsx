import React from 'react';
import { View, Text, Pressable, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { theme } from '@/constants/theme';
import { BASE_URL } from '@/api/client';

const IMG = (path: string) => ({ uri: `${BASE_URL.replace(/\/$/, '')}${path}` });

const DESTINATIONS = [
  {
    id: 'Jeju',
    name: 'Jeju',
    desc: 'Nature & UNESCO',
    color: '#059669',
    border: '#10b981',
    image: IMG('/images/destinations/jeju-card.jpg'),
  },
  {
    id: 'Seoul',
    name: 'Seoul',
    desc: 'Palaces & culture',
    color: '#2563eb',
    border: '#3b82f6',
    image: IMG('/images/destinations/seoul-card.jpg'),
  },
  {
    id: 'Busan',
    name: 'Busan',
    desc: 'Coastal & culture',
    color: '#ea580c',
    border: '#f97316',
    image: IMG('/images/destinations/busan-card.jpg'),
  },
];

export default function DestinationsCards() {
  const router = useRouter();

  return (
    <View style={styles.section}>
      <Text style={styles.title}>Explore destinations</Text>
      <View style={styles.row}>
        {DESTINATIONS.map((d) => (
          <Pressable
            key={d.id}
            style={({ pressed }) => [
              styles.card,
              { borderColor: d.border },
              pressed && styles.cardPressed,
            ]}
            onPress={() => router.push(`/(tabs)/tours?city=${encodeURIComponent(d.id)}`)}
          >
            <Image
              source={d.image}
              style={styles.cardBgImage}
              resizeMode="cover"
            />
            <View style={styles.cardOverlay} />
            <View style={styles.cardContent}>
              <View style={[styles.dot, { backgroundColor: d.color }]} />
              <Text style={styles.cardTitle}>{d.name}</Text>
              <Text style={styles.cardDesc} numberOfLines={1}>
                {d.desc}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
  },
  title: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    justifyContent: 'space-between',
  },
  card: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
    minHeight: 100,
    overflow: 'hidden',
  },
  cardBgImage: {
    ...StyleSheet.absoluteFillObject,
  },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  cardContent: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  cardPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  cardDesc: {
    fontSize: 12,
    marginTop: 4,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
  },
});
