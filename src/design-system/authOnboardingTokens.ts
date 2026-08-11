import profile from './auth-onboarding-design-profile.json';

const t = profile.designTokens;
const layout = profile.layoutAndSpacing;
const typo = profile.typography.numericScale;

/** Typed accessors for `auth-onboarding-design-profile.json` */
export const authOnboarding = {
  spacing: t.spacing as Record<string, number>,
  radius: t.radius as Record<string, number>,
  borderWidth: t.borderWidth as Record<string, number>,
  screenPadding: layout.screenPadding,
  sectionSpacing: layout.sectionSpacing,
  typo: {
    display: typo.display,
    title: typo.title,
    heading: typo.heading,
    body: typo.body,
    caption: typo.caption,
    micro: typo.micro,
  },
  form: {
    canvas: '#f7f7f7',
    surface: '#FFFFFF',
    textPrimary: '#060b1e',
    textSecondary: '#3b4a46',
    textTertiary: '#999999',
    borderSubtle: '#e5e5e5',
    borderEmphasis: '#060b1e',
    // Brand primary CTA (webV2 teal) — high contrast on light forms
    primaryCtaFill: '#005151',
    primaryCtaText: '#FFFFFF',
    secondaryMutedFill: '#eafaf8',
    secondaryMutedText: '#060b1e',
    inputMinHeight: 56,
    inputRadius: 8,
  },
} as const;
