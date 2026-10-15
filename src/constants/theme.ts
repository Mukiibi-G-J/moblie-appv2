import {Dimensions} from 'react-native';
const {width, height} = Dimensions.get('window');

// Define types for COLORS, SIZES, and FONTS
interface Colors {
  [key: string]: string;
}

interface Sizes {
  base: number;
  font: number;
  radius: number;
  padding: number;
  largeTitle: number;
  h1: number;
  h2: number;
  h3: number;
  h4: number;
  h5: number;
  body1: number;
  body2: number;
  body3: number;
  body4: number;
  body5: number;
  width: number;
  height: number;
}

interface Font {
  fontFamily: string;
  fontSize: number;
  lineHeight?: number;
  letterSpacing?: number;
}

interface Fonts {
  [key: string]: Font;
}

export const COLORS: Colors = {
  // Primary Colors — aligned with webV2 (teal/gold)
  primary: '#005151', // Brand teal (webV2 s1 / primary)
  primary2: '#1a938a', // Mid teal (webV2 p1)
  primary3: '#003d3d', // Deep teal (pressed)

  // Secondary Colors
  secondary: '#060b1e', // Near-black text (webV2 mainTextColor)
  secondary2: '#3b4a46', // Body text (webV2 bodyText)

  // Accent Colors
  accent: '#ffbf3f', // Gold (webV2 s2)
  accent2: '#e8a115', // Darker gold (webV2 s3)

  // Status Colors
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#1a938a',

  // Neutral Colors
  grey: '#999',
  gray: '#4A5568',
  gray2: '#718096',
  gray3: '#A0AEC0',
  lightGray1: '#e5e5e5', // webV2 strokeColor
  lightGray2: '#f7f7f7', // webV2 softBg

  // Base Colors
  white: '#FFFFFF',
  black: '#060b1e',

  darkGray: '#666666',
  darkGray2: '#757575',
  red: '#EF4444',

  // Transparent Colors
  transparent: 'transparent',
  transparentPrimary: 'rgba(0, 81, 81, 0.08)',
  transparentPrimary2: 'rgba(0, 81, 81, 0.16)',
  transparentPrimary3: 'rgba(0, 81, 81, 0.24)',

  // Background Overlays
  overlay: 'rgba(0, 0, 0, 0.3)',
  overlay2: 'rgba(0, 0, 0, 0.6)',

  // Card and Surface Colors
  surface: '#FFFFFF',
  surfaceLight: '#f7f7f7',
  surfaceDark: '#1A202C',
  softBg2: '#eafaf8', // webV2 soft teal tint

  lightOrange: '#D4D4D4',
  lightOrange2: '#E5E5E5',

  blue: '#1a938a',
};

export const SIZES: Sizes = {
  // global sizes
  base: 8,
  font: 14,
  radius: 12,
  padding: 24,
  // font sizes
  largeTitle: 40,
  h1: 30,
  h2: 22,
  h3: 16,
  h4: 14,
  h5: 12,
  body1: 30,
  body2: 22,
  body3: 16,
  body4: 14,
  body5: 12,
  // app dimensions
  width,
  height,
};

export const FONTS: Fonts = {
  // Display & Headings — Outfit (matches webV2 next/font Outfit)
  largeTitle: {
    fontFamily: 'Outfit-Bold',
    fontSize: SIZES.largeTitle,
    letterSpacing: -0.5,
  },
  h1: {
    fontFamily: 'Outfit-Bold',
    fontSize: SIZES.h1,
    lineHeight: 36,
    letterSpacing: -0.3,
  },
  h2: {
    fontFamily: 'Outfit-SemiBold',
    fontSize: SIZES.h2,
    lineHeight: 30,
    letterSpacing: -0.2,
  },
  h3: {
    fontFamily: 'Outfit-SemiBold',
    fontSize: SIZES.h3,
    lineHeight: 22,
    letterSpacing: -0.1,
  },
  h4: {
    fontFamily: 'Outfit-Medium',
    fontSize: SIZES.h4,
    lineHeight: 22,
  },
  h5: {
    fontFamily: 'Outfit-Medium',
    fontSize: SIZES.h5,
    lineHeight: 22,
  },

  // Body Text
  body1: {
    fontFamily: 'Outfit-Regular',
    fontSize: SIZES.body1,
    lineHeight: 36,
    letterSpacing: 0.2,
  },
  body2: {
    fontFamily: 'Outfit-Regular',
    fontSize: SIZES.body2,
    lineHeight: 30,
    letterSpacing: 0.2,
  },
  body3: {
    fontFamily: 'Outfit-Regular',
    fontSize: SIZES.body3,
    lineHeight: 22,
    letterSpacing: 0.1,
  },
  body4: {
    fontFamily: 'Outfit-Regular',
    fontSize: SIZES.body4,
    lineHeight: 22,
  },
  body5: {
    fontFamily: 'Outfit-Regular',
    fontSize: SIZES.body5,
    lineHeight: 22,
  },

  // Special Styles
  button: {
    fontFamily: 'Outfit-SemiBold',
    fontSize: SIZES.body3,
    letterSpacing: 0.5,
  },
  caption: {
    fontFamily: 'Outfit-Regular',
    fontSize: SIZES.body5,
    letterSpacing: 0.2,
  },
};

const appTheme = {COLORS, SIZES, FONTS};

export default appTheme;
