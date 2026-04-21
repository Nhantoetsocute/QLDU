import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppTheme } from '../theme/ThemeContext';

const STORAGE_KEY = '@selected_language';

const languages = [
  { id: 'vi', name: 'Tiếng Việt', native: 'Vietnamese', flag: '🇻🇳' },
  { id: 'en', name: 'English', native: 'Tiếng Anh', flag: '🇬🇧' },
  { id: 'ja', name: '日本語', native: 'Tiếng Nhật', flag: '🇯🇵' },
  { id: 'ko', name: '한국어', native: 'Tiếng Hàn', flag: '🇰🇷' },
  { id: 'zh', name: '中文', native: 'Tiếng Trung', flag: '🇨🇳' },
  { id: 'fr', name: 'Français', native: 'Tiếng Pháp', flag: '🇫🇷' },
];

const LanguageScreen = ({ navigation }) => {
  const { isDarkMode, colors } = useAppTheme();
  const [selected, setSelected] = useState('vi');
  const [fadeAnim] = useState(new Animated.Value(0));

  const ui = {
    bg: colors.background,
    card: isDarkMode ? 'rgba(255,255,255,0.05)' : '#FFFFFF',
    cardBorder: isDarkMode ? 'rgba(212,175,55,0.15)' : 'rgba(0,0,0,0.06)',
    text: colors.text,
    subText: colors.subText,
    accent: colors.accent,
    divider: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    radioOuter: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)',
  };

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
    loadLanguage();
  }, []);

  const loadLanguage = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) setSelected(stored);
    } catch (e) { }
  };

  const selectLanguage = async (id) => {
    setSelected(id);
    await AsyncStorage.setItem(STORAGE_KEY, id);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: ui.bg }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={ui.accent} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: ui.text }]}>Ngôn ngữ</Text>
        <View style={{ width: 28 }} />
      </View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={{ opacity: fadeAnim }}
      >
        {/* INFO */}
        <View style={[styles.infoCard, { backgroundColor: 'rgba(212,175,55,0.08)', borderColor: 'rgba(212,175,55,0.2)' }]}>
          <Ionicons name="globe-outline" size={20} color={ui.accent} />
          <Text style={[styles.infoText, { color: ui.subText }]}>
            Chọn ngôn ngữ hiển thị cho ứng dụng True Juice.
          </Text>
        </View>

        {/* LANGUAGE LIST */}
        <View style={[styles.langCard, { backgroundColor: ui.card, borderColor: ui.cardBorder }]}>
          {languages.map((lang, index) => {
            const isSelected = selected === lang.id;
            return (
              <View key={lang.id}>
                <TouchableOpacity
                  style={styles.langRow}
                  onPress={() => selectLanguage(lang.id)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.flag}>{lang.flag}</Text>
                  <View style={styles.langTextContainer}>
                    <Text style={[styles.langName, { color: isSelected ? ui.accent : ui.text }]}>
                      {lang.name}
                    </Text>
                    <Text style={[styles.langNative, { color: ui.subText }]}>{lang.native}</Text>
                  </View>

                  {/* Radio Button */}
                  <View style={[styles.radioOuter, { borderColor: isSelected ? ui.accent : ui.radioOuter }]}>
                    {isSelected && <View style={[styles.radioInner, { backgroundColor: ui.accent }]} />}
                  </View>
                </TouchableOpacity>
                {index < languages.length - 1 && (
                  <View style={[styles.divider, { backgroundColor: ui.divider }]} />
                )}
              </View>
            );
          })}
        </View>

        <View style={styles.noteContainer}>
          <Ionicons name="information-circle-outline" size={16} color={ui.subText} />
          <Text style={[styles.noteText, { color: ui.subText }]}>
            Hiện tại ứng dụng hỗ trợ tối ưu cho Tiếng Việt. Các ngôn ngữ khác sẽ được cập nhật trong phiên bản tiếp theo.
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

  // Info card
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 25,
  },
  infoText: { fontSize: 14, marginLeft: 12, flex: 1, lineHeight: 20 },

  // Language list
  langCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 25,
  },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  flag: { fontSize: 28, marginRight: 14 },
  langTextContainer: { flex: 1 },
  langName: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  langNative: { fontSize: 13 },

  // Radio
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },

  divider: { height: 1, marginHorizontal: 18 },

  // Note
  noteContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 5,
  },
  noteText: { fontSize: 12, lineHeight: 18, marginLeft: 8, flex: 1 },
});

export default LanguageScreen;
