import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {useColorScheme, StatusBar} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {darkColors, lightColors, type SemanticColors} from '../theme/semanticColors';

const STORAGE_KEY = '@zentro_theme_preference';

export type ThemePreference = 'system' | 'light' | 'dark';

type ThemeContextValue = {
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
  resolvedScheme: 'light' | 'dark';
  isDark: boolean;
  colors: SemanticColors;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveScheme(
  preference: ThemePreference,
  system: 'light' | 'dark' | null | undefined,
): 'light' | 'dark' {
  if (preference === 'light') {
    return 'light';
  }
  if (preference === 'dark') {
    return 'dark';
  }
  return system === 'dark' ? 'dark' : 'light';
}

export function ThemeProvider({children}: {children: React.ReactNode}) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(raw => {
        if (raw === 'light' || raw === 'dark' || raw === 'system') {
          setPreferenceState(raw);
        }
      })
      .catch(() => {});
  }, []);

  const setPreference = useCallback((p: ThemePreference) => {
    setPreferenceState(p);
    AsyncStorage.setItem(STORAGE_KEY, p).catch(() => {});
  }, []);

  const resolvedScheme = useMemo(
    () => resolveScheme(preference, systemScheme),
    [preference, systemScheme],
  );

  const isDark = resolvedScheme === 'dark';
  const colors = isDark ? darkColors : lightColors;

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      setPreference,
      resolvedScheme,
      isDark,
      colors,
    }),
    [preference, setPreference, resolvedScheme, isDark, colors],
  );

  /** Match app background — avoids a saturated branded status strip. */
  const statusBarBg = colors.background;
  const statusBarStyle = isDark ? 'light-content' : 'dark-content';

  return (
    <ThemeContext.Provider value={value}>
      <StatusBar
        barStyle={statusBarStyle}
        backgroundColor={statusBarBg}
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
