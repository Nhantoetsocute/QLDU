import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../theme/ThemeContext';

export default function LoadingIndicator({ label = 'Đang tải...', fullScreen = false, style }) {
  const { colors } = useAppTheme();
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
      accessibilityLiveRegion="polite"
      style={[styles.container, fullScreen && { flex: 1, backgroundColor: colors.background }, style]}
    >
      <ActivityIndicator size="large" color={colors.accent} />
      <Text style={[styles.label, { color: colors.subText }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  label: { fontSize: 14, textAlign: 'center' },
});
