import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../theme/ThemeContext';

const PrivacyScreen = ({ navigation }) => {
  const { isDarkMode, colors } = useAppTheme();
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Quyền riêng tư</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView>
        <Text style={[styles.text, { color: colors.subText }]}>Chúng tôi bảo vệ dữ liệu cá nhân của bạn, chỉ sử dụng cho mục đích vận hành đơn hàng và chăm sóc khách hàng.</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '700' },
  text: { fontSize: 15, lineHeight: 24 },
});

export default PrivacyScreen;
