// utils/authTheme.ts
// Single source of truth for the Waypoint auth design system.
// Tripadvisor-inspired, Waypoint-native.

export const authColors = {
  // Backgrounds
  bg: '#FFFFFF',

  // Text hierarchy
  textPrimary: '#000000',
  textSecondary: '#4A4A4A',
  textTertiary: '#8A8A8A',
  textDisclaimer: '#6B6B6B',

  // Accent (links / underlines that intentionally read as blue, e.g. "Wrong email?")
  accent: '#007AFF',

  // CTA / surfaces
  ctaPrimaryBg: '#000000',
  ctaPrimaryText: '#FFFFFF',
  ctaSecondaryBg: '#FFFFFF',
  ctaSecondaryText: '#000000',
  ctaBorder: '#000000',

  // Input
  inputBg: '#FFFFFF',
  inputBorder: '#E5E5E5',
  inputBorderError: '#FF3B30',
  placeholder: '#8A8A8A',

  // Status
  error: '#FF3B30',
  errorBannerBg: '#FFF1F0',
  errorBannerBorder: '#FFCDD2',
  errorBannerText: '#C62828',
  success: '#34C759',

  // Brand glyphs
  googleBlue: '#4285F4',
} as const;

export const authSpace = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const authRadius = {
  input: 12,
  pill: 30,
} as const;

export const authType = {
  headline: {
    fontSize: 36,
    lineHeight: 42,
    letterSpacing: -0.5,
    fontWeight: '700' as const,
  },
  sectionTitle: {
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.3,
    fontWeight: '700' as const,
  },
  body: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '400' as const,
  },
  label: {
    fontSize: 15,
    fontWeight: '500' as const,
  },
  button: {
    fontSize: 17,
    fontWeight: '600' as const,
  },
  link: {
    fontSize: 15,
    fontWeight: '500' as const,
  },
  disclaimer: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400' as const,
  },
} as const;

export const authHitSlop = { top: 8, bottom: 8, left: 8, right: 8 } as const;
