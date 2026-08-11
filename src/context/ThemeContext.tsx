import React, {
  createContext,
  useContext,
  useMemo,
} from 'react';
import {StatusBar} from 'react-native';
import {lightColors, type SemanticColors} from '../theme/semanticColors';

/** Kept for type compatibility; app is light-only. */
export type ThemePreference = 'system' | 'light' | 'dark';

type ThemeContextValue = {
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
  resolvedScheme: 'light' | 'dark';
  isDark: boolean;
  colors: SemanticColors;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Light theme only — dark / system appearance is disabled.
 */
export function ThemeProvider({children}: {children: React.ReactNode}) {
  const value = useMemo<ThemeContextValue>(
    () => ({
      preference: 'light',
      setPreference: () => {
        /* Dark theme removed — no-op */
      },
      resolvedScheme: 'light',
      isDark: false,
      colors: lightColors,
    }),
    [],
  );

  return (
    <ThemeContext.Provider value={value}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={lightColors.background}
        translucent
      />
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}

export function useThemeOptional(): ThemeContextValue | null {
  return useContext(ThemeContext);
}
