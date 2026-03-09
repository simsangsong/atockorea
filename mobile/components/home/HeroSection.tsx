import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ImageBackground,
  StyleSheet,
  Dimensions,
  Pressable,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { theme } from '@/constants/theme';
import { BASE_URL } from '@/api/client';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_HEIGHT = 220;
const AUTO_PLAY_MS = 5000;

const HERO_IMAGES = [
  { id: 1, image: '/images/hero/jeju-hero.jpg', title: 'Explore Jeju Island' },
  { id: 2, image: '/images/hero/busan-hero.jpg', title: 'Experience Busan' },
  { id: 3, image: '/images/hero/seoul-hero.jpg', title: 'Discover Korea' },
];

function buildImageUri(path: string): string {
  const base = BASE_URL.replace(/\/$/, '');
  return path.startsWith('http') ? path : `${base}${path.startsWith('/') ? '' : '/'}${path}`;
}

export default function HeroSection() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => {
        const next = (prev + 1) % HERO_IMAGES.length;
        scrollRef.current?.scrollTo({ x: next * SCREEN_WIDTH, animated: true });
        return next;
      });
    }, AUTO_PLAY_MS);
    return () => clearInterval(interval);
  }, []);

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offset = e.nativeEvent.contentOffset.x;
    setCurrentIndex(Math.round(offset / SCREEN_WIDTH));
  };

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
    scrollRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
  };

  return (
    <View style={styles.wrapper}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumScrollEnd}
        onScroll={(e) => {
          const offset = e.nativeEvent.contentOffset.x;
          const i = Math.round(offset / SCREEN_WIDTH);
          if (i >= 0 && i < HERO_IMAGES.length) setCurrentIndex(i);
        }}
        scrollEventThrottle={32}
        decelerationRate="fast"
        style={styles.scroll}
        contentContainerStyle={{ width: SCREEN_WIDTH * HERO_IMAGES.length }}
      >
        {HERO_IMAGES.map((item) => (
          <View key={item.id} style={[styles.slide, { width: SCREEN_WIDTH }]}>
            <ImageBackground
              source={{ uri: buildImageUri(item.image) }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            >
              <View style={styles.overlay} />
              <View style={styles.content}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.subtitle}>Find your perfect Korea tour</Text>
              </View>
            </ImageBackground>
          </View>
        ))}
      </ScrollView>
      <View style={styles.dots}>
        {HERO_IMAGES.map((_, index) => (
          <Pressable
            key={index}
            onPress={() => goToSlide(index)}
            style={[styles.dot, index === currentIndex && styles.dotActive]}
            accessibilityLabel={`Slide ${index + 1}`}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    height: HERO_HEIGHT,
  },
  scroll: {
    flex: 1,
  },
  slide: {
    height: HERO_HEIGHT,
    overflow: 'hidden',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  content: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: theme.spacing.md,
  },
  title: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: theme.colors.white,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  subtitle: {
    fontSize: theme.fontSize.sm,
    color: 'rgba(255,255,255,0.95)',
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  dots: {
    position: 'absolute',
    bottom: theme.spacing.sm,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  dotActive: {
    backgroundColor: theme.colors.white,
    width: 10,
    height: 8,
    borderRadius: 4,
  },
});
