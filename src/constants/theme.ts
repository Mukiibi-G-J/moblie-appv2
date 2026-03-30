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
  // Primary Colors
  primary: '#0286FF', // Bright Blue - Your main brand color
  primary2: '#0066CC', // Medium Blue
  primary3: '#0047AB', // Deep Blue

  // Secondary Colors
  secondary: '#2C3E50', // Dark Blue-Gray
  secondary2: '#34495E', // Lighter Blue-Gray

  // Accent Colors
  accent: '#00A3FF', // Light Blue
  accent2: '#4DB6FF', // Sky Blue

  // Status Colors
  success: '#00B894', // Teal Green
  warning: '#FFA133', // Warm Orange
  error: '#FF4757', // Soft Red
  info: '#2E86DE', // Info Blue

  // Neutral Colors
  grey: '#999',
  gray: '#4A5568', // Dark Gray
  gray2: '#718096', // Medium Gray
  gray3: '#A0AEC0', // Light Gray
  lightGray1: '#E2E8F0', // Very Light Gray
  lightGray2: '#F7FAFC', // Almost White Gray

  // Base Colors
  white: '#FFFFFF',
  black: '#1A202C', // Soft Black

  darkGray: '#666666',
  darkGray2: '#757575',
  red: '#FF4757',

  // Transparent Colors
  transparent: 'transparent',
  transparentPrimary: 'rgba(2, 134, 255, 0.08)', // Very Light Blue
  transparentPrimary2: 'rgba(2, 134, 255, 0.16)', // Light Blue
  transparentPrimary3: 'rgba(2, 134, 255, 0.24)', // Medium Blue

  // Background Overlays
  overlay: 'rgba(0, 0, 0, 0.3)',
  overlay2: 'rgba(0, 0, 0, 0.6)',

  // Card and Surface Colors
  surface: '#FFFFFF',
  surfaceLight: '#F8FAFC',
  surfaceDark: '#1A202C',

  lightOrange: '#D4D4D4',
  lightOrange2: '#E5E5E5',

  blue: '#0066CC',
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
  // Display & Headings
  largeTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: SIZES.largeTitle,
    letterSpacing: -0.5,
  },
  h1: {
    fontFamily: 'Inter-Bold',
    fontSize: SIZES.h1,
    lineHeight: 36,
    letterSpacing: -0.3,
  },
  h2: {
    fontFamily: 'Inter-SemiBold',
    fontSize: SIZES.h2,
    lineHeight: 30,
    letterSpacing: -0.2,
  },
  h3: {
    fontFamily: 'Inter-SemiBold',
    fontSize: SIZES.h3,
    lineHeight: 22,
    letterSpacing: -0.1,
  },
  h4: {
    fontFamily: 'Inter-Medium',
    fontSize: SIZES.h4,
    lineHeight: 22,
  },
  h5: {
    fontFamily: 'Inter-Medium',
    fontSize: SIZES.h5,
    lineHeight: 22,
  },

  // Body Text
  body1: {
    fontFamily: 'Inter-Regular',
    fontSize: SIZES.body1,
    lineHeight: 36,
    letterSpacing: 0.2,
  },
  body2: {
    fontFamily: 'Inter-Regular',
    fontSize: SIZES.body2,
    lineHeight: 30,
    letterSpacing: 0.2,
  },
  body3: {
    fontFamily: 'Inter-Regular',
    fontSize: SIZES.body3,
    lineHeight: 22,
    letterSpacing: 0.1,
  },
  body4: {
    fontFamily: 'Inter-Regular',
    fontSize: SIZES.body4,
    lineHeight: 22,
  },
  body5: {
    fontFamily: 'Inter-Regular',
    fontSize: SIZES.body5,
    lineHeight: 22,
  },

  // Special Styles
  button: {
    fontFamily: 'Inter-SemiBold',
    fontSize: SIZES.body3,
    letterSpacing: 0.5,
  },
  caption: {
    fontFamily: 'Inter-Regular',
    fontSize: SIZES.body5,
    letterSpacing: 0.2,
  },
};

const appTheme = {COLORS, SIZES, FONTS};

export default appTheme;
