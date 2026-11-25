import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import LoadingIndicator from './LoadingIndicator';
import { useAppTheme } from '../theme/ThemeContext';

// Keep screens mounted beneath the brief page-entry animation so data can load immediately.
function ScreenLoadingLayout({ children }) {
  const { colors } = useAppTheme();
  const [opening, setOpening] = useState(true);

  useFocusEffect(useCallback(() => {
    setOpening(true);
    const timer = setTimeout(() => setOpening(false), 250);
    return () => clearTimeout(timer);
  }, []));

  return (
    <View style={styles.root}>
      {children}
      {opening && (
        <LoadingIndicator
          label="Đang mở trang..."
          style={[styles.overlay, { backgroundColor: colors.background }]}
        />
      )}
    </View>
  );
}

export const renderScreenLoadingLayout = ({ children, route }) => (
  route.name === 'MainTabs' ? children : <ScreenLoadingLayout>{children}</ScreenLoadingLayout>
);

const styles = StyleSheet.create({
  root: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 10 },
});
