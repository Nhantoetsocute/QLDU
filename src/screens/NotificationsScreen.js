import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  StatusBar,
  ScrollView,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppTheme } from '../theme/ThemeContext';

const STORAGE_KEY = '@notification_settings';

const defaultSettings = {
  promotions: true,
  orderStatus: true,
  newProducts: false,
  reminders: false,
  newsletter: false,
};

const notificationItems = [
  {
    key: 'promotions',
    icon: 'gift-outline',
    iconType: 'ionicon',
    title: 'Ưu đãi & Khuyến mãi',
    description: 'Nhận thông báo về voucher, giảm giá và chương trình đặc biệt.',
  },
  {
    key: 'orderStatus',
    icon: 'receipt-outline',
    iconType: 'ionicon',
    title: 'Trạng thái đơn hàng',
    description: 'Cập nhật khi đơn hàng được xác nhận, đang giao và hoàn thành.',
  },
  {
    key: 'newProducts',
    icon: 'sparkles-outline',
    iconType: 'ionicon',
    title: 'Sản phẩm mới',
    description: 'Khám phá những thức uống mới nhất từ True Juice.',
  },
  {
    key: 'reminders',
    icon: 'water-outline',
    iconType: 'ionicon',
    title: 'Nhắc nhở uống nước',
    description: 'Nhắc bạn bổ sung nước đều đặn mỗi ngày.',
  },
  {
    key: 'newsletter',
    icon: 'newspaper-outline',
    iconType: 'ionicon',
    title: 'Bản tin True Juice',
    description: 'Tin tức sức khỏe, công thức detox và mẹo dinh dưỡng.',
  },
];

const NotificationsScreen = ({ navigation }) => {
  const { isDarkMode, colors } = useAppTheme();
  const [settings, setSettings] = useState(defaultSettings);
  const [fadeAnim] = useState(new Animated.Value(0));

  const ui = {
    bg: colors.background,
    card: isDarkMode ? 'rgba(255,255,255,0.05)' : '#FFFFFF',
    cardBorder: isDarkMode ? 'rgba(212,175,55,0.15)' : 'rgba(0,0,0,0.06)',
    text: colors.text,
    subText: colors.subText,
    accent: colors.accent,
    divider: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
  };

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) setSettings(JSON.parse(stored));
    } catch (e) {
      console.error(e);
    }
  };

  const toggleSetting = useCallback(async (key) => {
    setSettings(prev => {
      const updated = { ...prev, [key]: !prev[key] };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const allEnabled = Object.values(settings).every(v => v);

  const toggleAll = useCallback(async () => {
    const newVal = !allEnabled;
    const updated = {};
    Object.keys(settings).forEach(k => { updated[k] = newVal; });
    setSettings(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }, [allEnabled, settings]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: ui.bg }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={ui.accent} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: ui.text }]}>Thông báo</Text>
        <View style={{ width: 28 }} />
      </View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={{ opacity: fadeAnim }}
      >
        {/* MASTER TOGGLE */}
        <View style={[styles.masterCard, { backgroundColor: ui.card, borderColor: ui.cardBorder }]}>
          <View style={styles.masterLeft}>
            <View style={[styles.iconBox, { backgroundColor: 'rgba(212,175,55,0.12)' }]}>
              <Ionicons name="notifications" size={22} color={ui.accent} />
            </View>
            <View>
              <Text style={[styles.masterTitle, { color: ui.text }]}>Tất cả thông báo</Text>
              <Text style={[styles.masterSub, { color: ui.subText }]}>
                {allEnabled ? 'Đang bật tất cả' : 'Một số đang tắt'}
              </Text>
            </View>
          </View>
          <Switch
            trackColor={{ false: '#555', true: ui.accent }}
            thumbColor="#FFF"
            ios_backgroundColor="#555"
            value={allEnabled}
            onValueChange={toggleAll}
          />
        </View>

        {/* NOTIFICATION ITEMS */}
        <Text style={[styles.sectionTitle, { color: ui.subText }]}>DANH MỤC THÔNG BÁO</Text>
        <View style={[styles.sectionCard, { backgroundColor: ui.card, borderColor: ui.cardBorder }]}>
          {notificationItems.map((item, index) => (
            <View key={item.key}>
              <View style={styles.notifRow}>
                <View style={styles.notifLeft}>
                  <View style={[styles.iconBox, { backgroundColor: settings[item.key] ? 'rgba(212,175,55,0.12)' : 'rgba(128,128,128,0.1)' }]}>
                    <Ionicons
                      name={item.icon}
                      size={20}
                      color={settings[item.key] ? ui.accent : ui.subText}
                    />
                  </View>
                  <View style={styles.notifTextContainer}>
                    <Text style={[styles.notifTitle, { color: ui.text }]}>{item.title}</Text>
                    <Text style={[styles.notifDesc, { color: ui.subText }]}>{item.description}</Text>
                  </View>
                </View>
                <Switch
                  trackColor={{ false: '#555', true: ui.accent }}
                  thumbColor="#FFF"
                  ios_backgroundColor="#555"
                  value={settings[item.key]}
                  onValueChange={() => toggleSetting(item.key)}
                />
              </View>
              {index < notificationItems.length - 1 && (
                <View style={[styles.divider, { backgroundColor: ui.divider }]} />
              )}
            </View>
          ))}
        </View>

        {/* INFO */}
        <View style={styles.infoContainer}>
          <Ionicons name="information-circle-outline" size={16} color={ui.subText} />
          <Text style={[styles.infoText, { color: ui.subText }]}>
            Bạn có thể thay đổi cài đặt thông báo bất cứ lúc nào. True Juice cam kết không gửi spam.
          </Text>
        </View>
      </Animated.ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 15,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 22, fontWeight: '800', letterSpacing: 0.5 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },

  // Master toggle
  masterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  masterLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  masterTitle: { fontSize: 17, fontWeight: '700', marginBottom: 2 },
  masterSub: { fontSize: 13 },

  // Section
  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 10,
    marginLeft: 5,
  },
  sectionCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 25,
  },

  // Notification row
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  notifLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12 },
  notifTextContainer: { flex: 1 },
  notifTitle: { fontSize: 15, fontWeight: '600', marginBottom: 3 },
  notifDesc: { fontSize: 12, lineHeight: 17 },

  // Shared
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  divider: { height: 1, marginHorizontal: 18 },

  // Info
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 5,
  },
  infoText: { fontSize: 12, lineHeight: 18, marginLeft: 8, flex: 1 },
});

export default NotificationsScreen;
