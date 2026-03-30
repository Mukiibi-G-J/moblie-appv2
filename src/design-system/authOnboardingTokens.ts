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
    canvas: '#F5F5F5',
    surface: '#FFFFFF',
    textPrimary: '#000000',
    textSecondary: '#666666',
    textTertiary: '#999999',
    borderSubtle: '#E0E0E0',
    borderEmphasis: '#000000',
    primaryCtaFill: '#000000',
    primaryCtaText: '#FFFFFF',
    secondaryMutedFill: '#F2F2F2',
    secondaryMutedText: '#000000',
    inputMinHeight: 56,
    inputRadius: 8,
  },
} as const;
