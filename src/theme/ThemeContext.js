import React, { createContext, useContext, useMemo, useState } from 'react';
import { DefaultTheme, DarkTheme } from '@react-navigation/native';

const ThemeContext = createContext(null);

const darkColors = {
  background: '#0A0A0A',
  card: 'rgba(255,255,255,0.06)',
  text: '#FFFFFF',
  subText: '#A9A9A9',
  border: 'rgba(212, 175, 55, 0.2)',
  accent: '#D4AF37',
  tabBarBackground: '#0A0A0A',
  tabBarInactive: '#666',
  overlay: 'rgba(10, 10, 10, 0.85)',
};

const lightColors = {
  background: '#F4F6F8',
  card: '#FFFFFF',
  text: '#1A1A1A',
  subText: '#6B7280',
  border: 'rgba(184, 134, 11, 0.25)',
  accent: '#B8860B',
  tabBarBackground: '#FFFFFF',
  tabBarInactive: '#8B8B8B',
  overlay: 'rgba(255, 255, 255, 0.34)',
};

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(true);

  const value = useMemo(() => {
    const colors = isDarkMode ? darkColors : lightColors;
    const baseNavigationTheme = isDarkMode ? DarkTheme : DefaultTheme;

    return {
      isDarkMode,
      colors,
      toggleTheme: () => setIsDarkMode((prev) => !prev),
      setThemeMode: (dark) => setIsDarkMode(Boolean(dark)),
      navigationTheme: {
        ...baseNavigationTheme,
        dark: isDarkMode,
        colors: {
          ...baseNavigationTheme.colors,
          primary: colors.accent,
          background: colors.background,
          card: colors.card,
          text: colors.text,
          border: colors.border,
          notification: '#E74C3C',
        },
        fonts: {
          ...(baseNavigationTheme.fonts || {}),
          regular: baseNavigationTheme?.fonts?.regular || {
            fontFamily: undefined,
            fontWeight: '400',
          },
          medium: baseNavigationTheme?.fonts?.medium || {
            fontFamily: undefined,
            fontWeight: '500',
          },
          bold: baseNavigationTheme?.fonts?.bold || {
            fontFamily: undefined,
            fontWeight: '700',
          },
          heavy: baseNavigationTheme?.fonts?.heavy || {
            fontFamily: undefined,
            fontWeight: '800',
          },
        },
      },
    };
  }, [isDarkMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useAppTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useAppTheme must be used within ThemeProvider');
  }
  return context;
};
