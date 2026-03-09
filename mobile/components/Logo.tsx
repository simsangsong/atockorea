/**
 * Logo component – matches web components/Logo.tsx (circular A2C icon + AtoC Korea text).
 */
import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Stop, Text as SvgText } from 'react-native-svg';

const LOGO_BLUE = '#3B82F6';
const LOGO_BLUE_DARK = '#2563EB';
const LOGO_ORANGE = '#F97316';
const TAGLINE_GRAY = '#6b7280';

type LogoProps = {
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
};

const ICON_SIZES = { sm: 32, md: 40, lg: 48 };
const TITLE_SIZES = { sm: 12, md: 16, lg: 20 };
const TAGLINE_SIZES = { sm: 7, md: 9, lg: 11 };

export default function Logo({ size = 'md', style }: LogoProps) {
  const iconSize = ICON_SIZES[size];
  const titleSize = TITLE_SIZES[size];
  const taglineSize = TAGLINE_SIZES[size];
  const viewBox = 48;

  return (
    <View style={[styles.wrap, style]}>
      <View style={[styles.iconWrap, { width: iconSize, height: iconSize }]}>
        <Svg width={iconSize} height={iconSize} viewBox={`0 0 ${viewBox} ${viewBox}`}>
          <Defs>
            <LinearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={LOGO_BLUE} />
              <Stop offset="50%" stopColor={LOGO_BLUE_DARK} />
              <Stop offset="100%" stopColor={LOGO_ORANGE} />
            </LinearGradient>
            <RadialGradient id="radialGradient" cx="50%" cy="30%" r="70%">
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.3" />
              <Stop offset="100%" stopColor="#000000" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          {/* Outer decorative ring */}
          <Circle cx="24" cy="24" r="22" fill="none" stroke="url(#logoGradient)" strokeWidth="1.5" opacity="0.3" />
          {/* Main circle with gradient */}
          <Circle cx="24" cy="24" r="20" fill="url(#logoGradient)" />
          {/* Radial highlight overlay */}
          <Circle cx="24" cy="24" r="20" fill="url(#radialGradient)" />
          {/* Inner accent circle */}
          <Circle cx="24" cy="24" r="16" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />
          {/* A2C text */}
          <SvgText
            x="24"
            y="30"
            fontSize="14"
            fontWeight="900"
            fill="white"
            textAnchor="middle"
            fontFamily="system-ui, -apple-system, sans-serif"
          >
            A2C
          </SvgText>
          {/* Decorative dots */}
          <Circle cx="24" cy="12" r="1.5" fill="rgba(255,255,255,0.6)" />
          <Circle cx="24" cy="36" r="1.5" fill="rgba(255,255,255,0.6)" />
          <Circle cx="12" cy="24" r="1.5" fill="rgba(255,255,255,0.6)" />
          <Circle cx="36" cy="24" r="1.5" fill="rgba(255,255,255,0.6)" />
        </Svg>
      </View>
      <View style={styles.textWrap}>
        <View style={styles.titleRow}>
          <Text style={[styles.titleAtoC, { fontSize: titleSize }]}>AtoC</Text>
          <Text style={[styles.titleKorea, { fontSize: titleSize }]}> Korea</Text>
        </View>
        <Text style={[styles.tagline, { fontSize: taglineSize }]}>AGENCY TO CUSTOMER</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconWrap: {
    flexShrink: 0,
  },
  textWrap: {
    flexDirection: 'column',
    justifyContent: 'center',
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  titleAtoC: {
    fontWeight: '800',
    color: LOGO_BLUE,
  },
  titleKorea: {
    fontWeight: '800',
    color: LOGO_ORANGE,
  },
  tagline: {
    fontWeight: '600',
    color: TAGLINE_GRAY,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
