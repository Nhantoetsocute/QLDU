import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../theme/ThemeContext';

const HelpCenterScreen = ({ navigation }) => {
  const { isDarkMode, colors } = useAppTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Trung tâm trợ giúp</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.item, { color: colors.text }]}>Hotline: 1900 6868</Text>
        <Text style={[styles.item, { color: colors.text }]}>Email: support@truejuice.vn</Text>
        <Text style={[styles.item, { color: colors.text }]}>Thời gian hỗ trợ: 08:00 - 22:00</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '700' },
  card: { borderWidth: 1, borderRadius: 14, padding: 16 },
  item: { fontSize: 15, marginBottom: 12 },
});

export default HelpCenterScreen;
