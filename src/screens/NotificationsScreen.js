import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../theme/ThemeContext';

const NotificationsScreen = ({ navigation }) => {
  const { isDarkMode, colors } = useAppTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Thông báo</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.row}>
          <Text style={[styles.label, { color: colors.text }]}>Ưu đãi mới</Text>
          <Switch value={true} />
        </View>
        <View style={styles.row}>
          <Text style={[styles.label, { color: colors.text }]}>Cập nhật trạng thái đơn</Text>
          <Switch value={true} />
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '700' },
  card: { borderWidth: 1, borderRadius: 14, padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  label: { fontSize: 16, fontWeight: '600' },
});

export default NotificationsScreen;
