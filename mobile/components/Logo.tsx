/**
 * Logo component — aligned with web `components/Logo.tsx` (geometric mark + AtoC / Korea hierarchy).
 */
import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import Svg, { Rect, Path, Defs, ClipPath, G, LinearGradient, Stop } from 'react-native-svg';

const BRAND_PRIMARY = '#1E2A3A';
const BRAND_WORDMARK_KOREA = '#4A5A6A';
const BRAND_TAGLINE_MUTED = '#586574';
const TAGLINE = 'Curated Korea, Direct';

type LogoProps = {
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
};

const ICON_SIZES = { sm: 32, md: 40, lg: 48 };
/** Title scale ~20–24px equivalent at lg */
const ATOC_SIZES = { sm: 17, md: 20, lg: 22 };
const KOREA_SIZES = { sm: 14, md: 16, lg: 18 };
/** Subtitle 11–13px */
const TAGLINE_SIZES = { sm: 11, md: 12, lg: 13 };

const CLIP_ID = 'atocLogoMarkClip';
const GRAD_OUTER_ID = 'atocMarkOuterDepth';
const GRAD_LINE_ID = 'atocMarkLineAir';

export default function Logo({ size = 'md', style }: LogoProps) {
  const iconSize = ICON_SIZES[size];
  const atocSize = ATOC_SIZES[size];
  const koreaSize = KOREA_SIZES[size];
  const taglineSize = TAGLINE_SIZES[size];
  const vb = 40;

  return (
    <View style={[styles.wrap, style]}>
      <View style={[styles.iconWrap, { width: iconSize, height: iconSize }]}>
        <Svg width={iconSize} height={iconSize} viewBox={`0 0 ${vb} ${vb}`}>
          <Defs>
            <ClipPath id={CLIP_ID}>
              <Rect x={1} y={1} width={38} height={38} rx={9.5} />
            </ClipPath>
            <LinearGradient id={GRAD_OUTER_ID} x1={6} y1={3} x2={36} y2={38} gradientUnits="userSpaceOnUse">
              <Stop offset="0%" stopColor="#2a3a50" />
              <Stop offset="42%" stopColor={BRAND_PRIMARY} />
              <Stop offset="100%" stopColor="#121a24" />
            </LinearGradient>
            <LinearGradient id={GRAD_LINE_ID} x1={10} y1={11} x2={30} y2={29} gradientUnits="userSpaceOnUse">
              <Stop offset="0%" stopColor="rgba(255,255,255,0.98)" />
              <Stop offset="100%" stopColor="rgba(255,255,255,0.76)" />
            </LinearGradient>
          </Defs>
          <Rect x={1} y={1} width={38} height={38} rx={9.5} fill={`url(#${GRAD_OUTER_ID})`} />
          <G clipPath={`url(#${CLIP_ID})`}>
            <Rect
              x={9.5}
              y={9.5}
              width={21}
              height={21}
              rx={4.85}
              fill="none"
              stroke={`url(#${GRAD_LINE_ID})`}
              strokeWidth={1.08}
              opacity={1}
            />
            <Path
              d="M14.5 25.5 L20 16.2 L25.5 25.5"
              fill="none"
              stroke={`url(#${GRAD_LINE_ID})`}
              strokeWidth={1.62}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={1}
            />
          </G>
        </Svg>
      </View>
      <View style={styles.textWrap}>
        <View style={styles.titleRow}>
          <Text style={[styles.titleAtoC, { fontSize: atocSize, lineHeight: Math.round(atocSize * 1.2) }]}>
            AtoC
          </Text>
          <Text style={[styles.titleKorea, { fontSize: koreaSize, lineHeight: Math.round(koreaSize * 1.2) }]}>
            {' '}Korea
          </Text>
        </View>
        <Text
          style={[styles.tagline, { fontSize: taglineSize, letterSpacing: taglineSize * 0.08 }]}
        >
          {TAGLINE}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconWrap: {
    flexShrink: 0,
  },
  textWrap: {
    flexDirection: 'column',
    justifyContent: 'center',
    minWidth: 0,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  titleAtoC: {
    fontWeight: '600',
    letterSpacing: -0.5,
    color: BRAND_PRIMARY,
  },
  titleKorea: {
    fontWeight: '500',
    letterSpacing: -0.2,
    color: BRAND_WORDMARK_KOREA,
  },
  tagline: {
    fontWeight: '500',
    color: BRAND_TAGLINE_MUTED,
    opacity: 0.77,
  },
});
