/** Semantic UI colors for light / dark (auth, shell, common surfaces) */

export type SemanticColors = {
  background: string;
  screenMuted: string;
  surface: string;
  card: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  border: string;
  borderStrong: string;
  inputBackground: string;
  placeholder: string;
  tabBar: string;
  tabInactive: string;
  iconMuted: string;
  backButtonBg: string;
};

export const lightColors: SemanticColors = {
  background: '#FFFFFF',
  screenMuted: '#F5F5F5',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  textPrimary: '#000000',
  textSecondary: '#666666',
  textTertiary: '#999999',
  border: '#E0E0E0',
  borderStrong: '#000000',
  inputBackground: '#FFFFFF',
  placeholder: '#999999',
  tabBar: '#FFFFFF',
  tabInactive: '#FFFFFF',
  iconMuted: '#999999',
  backButtonBg: '#F2F2F2',
};

export const darkColors: SemanticColors = {
  background: '#121212',
  screenMuted: '#121212',
  surface: '#1E1E1E',
  card: '#2C2C2C',
  textPrimary: '#F5F5F5',
  textSecondary: '#B3B3B3',
  textTertiary: '#8E8E8E',
  border: '#3A3A3A',
  borderStrong: '#E0E0E0',
  inputBackground: '#2C2C2C',
  placeholder: '#8E8E8E',
  tabBar: '#1E1E1E',
  tabInactive: '#2C2C2C',
  iconMuted: '#A0A0A0',
  backButtonBg: '#3A3A3A',
};
