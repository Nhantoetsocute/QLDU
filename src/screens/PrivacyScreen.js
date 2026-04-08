import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../theme/ThemeContext';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const privacySections = [
  {
    icon: 'shield-checkmark-outline',
    title: '1. Thu thập thông tin',
    content: 'True Juice thu thập các thông tin cá nhân sau khi bạn đăng ký tài khoản:\n\n• Họ và tên\n• Địa chỉ email\n• Số điện thoại\n• Địa chỉ giao hàng\n\nChúng tôi chỉ thu thập những thông tin cần thiết để xử lý đơn hàng và cung cấp dịch vụ khách hàng tốt nhất.',
  },
  {
    icon: 'lock-closed-outline',
    title: '2. Bảo mật dữ liệu',
    content: 'Dữ liệu cá nhân của bạn được bảo vệ bằng các biện pháp an ninh sau:\n\n• Mã hóa mật khẩu bằng bcrypt (không lưu plaintext)\n• Kết nối SSL/TLS cho tất cả giao dịch\n• JWT Token xác thực phiên đăng nhập\n• Giới hạn quyền truy cập dữ liệu nội bộ\n\nChúng tôi cam kết không bao giờ chia sẻ mật khẩu hoặc thông tin thanh toán của bạn.',
  },
  {
    icon: 'share-social-outline',
    title: '3. Chia sẻ thông tin',
    content: 'True Juice KHÔNG bao giờ bán hoặc chia sẻ thông tin cá nhân của bạn cho bên thứ ba, ngoại trừ:\n\n• Đối tác giao hàng (chỉ tên, SĐT và địa chỉ để giao đơn)\n• Cổng thanh toán VNPAY (theo yêu cầu giao dịch)\n• Cơ quan pháp luật (khi có yêu cầu hợp pháp)',
  },
  {
    icon: 'trash-outline',
    title: '4. Quyền xóa dữ liệu',
    content: 'Bạn có quyền yêu cầu xóa toàn bộ dữ liệu cá nhân bất cứ lúc nào:\n\n• Liên hệ qua email: support@truejuice.vn\n• Gọi hotline: 1900 6868\n• Thời gian xử lý: 3–5 ngày làm việc\n\nSau khi xóa, tài khoản sẽ không thể khôi phục.',
  },
  {
    icon: 'nutrition-outline',
    title: '5. Cookie & Tracking',
    content: 'Ứng dụng True Juice sử dụng AsyncStorage (lưu trữ cục bộ) để:\n\n• Giữ phiên đăng nhập\n• Lưu cài đặt giao diện (sáng/tối)\n• Lưu giỏ hàng tạm thời\n\nChúng tôi KHÔNG sử dụng cookie theo dõi hành vi hoặc quảng cáo cá nhân hóa.',
  },
  {
    icon: 'refresh-outline',
    title: '6. Cập nhật chính sách',
    content: 'Chính sách quyền riêng tư có thể được cập nhật theo thời gian. Khi có thay đổi quan trọng, chúng tôi sẽ:\n\n• Gửi thông báo qua email\n• Hiển thị popup trong ứng dụng\n• Cập nhật ngày có hiệu lực tại đây\n\nNgày cập nhật gần nhất: 01/04/2026',
  },
];

const PrivacyScreen = ({ navigation }) => {
  const { isDarkMode, colors } = useAppTheme();
  const [expandedIndex, setExpandedIndex] = useState(null);

  const ui = {
    bg: colors.background,
    card: isDarkMode ? 'rgba(255,255,255,0.05)' : '#FFFFFF',
    cardBorder: isDarkMode ? 'rgba(212,175,55,0.15)' : 'rgba(0,0,0,0.06)',
    text: colors.text,
    subText: colors.subText,
    accent: colors.accent,
    divider: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
  };

  const toggleSection = (index) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: ui.bg }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={ui.accent} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: ui.text }]}>Quyền riêng tư</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* INTRO */}
        <View style={[styles.introCard, { backgroundColor: 'rgba(212,175,55,0.08)', borderColor: 'rgba(212,175,55,0.2)' }]}>
          <Ionicons name="shield-checkmark" size={24} color={ui.accent} />
          <View style={styles.introTextContainer}>
            <Text style={[styles.introTitle, { color: ui.text }]}>Cam kết bảo mật</Text>
            <Text style={[styles.introDesc, { color: ui.subText }]}>
              True Juice tôn trọng quyền riêng tư của bạn. Đọc chi tiết bên dưới.
            </Text>
          </View>
        </View>

        {/* SECTIONS */}
        <View style={[styles.sectionsCard, { backgroundColor: ui.card, borderColor: ui.cardBorder }]}>
          {privacySections.map((section, index) => {
            const isExpanded = expandedIndex === index;
            return (
              <View key={index}>
                <TouchableOpacity
                  style={styles.sectionHeader}
                  onPress={() => toggleSection(index)}
                  activeOpacity={0.7}
                >
                  <View style={styles.sectionLeft}>
                    <View style={[styles.iconBox, { backgroundColor: isExpanded ? 'rgba(212,175,55,0.15)' : 'rgba(128,128,128,0.08)' }]}>
                      <Ionicons name={section.icon} size={20} color={isExpanded ? ui.accent : ui.subText} />
                    </View>
                    <Text style={[styles.sectionTitle, { color: isExpanded ? ui.accent : ui.text }]}>
                      {section.title}
                    </Text>
                  </View>
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={ui.subText}
                  />
                </TouchableOpacity>

                {isExpanded && (
                  <View style={[styles.sectionContent, { borderTopColor: ui.divider }]}>
                    <Text style={[styles.sectionText, { color: ui.subText }]}>{section.content}</Text>
                  </View>
                )}

                {index < privacySections.length - 1 && (
                  <View style={[styles.divider, { backgroundColor: ui.divider }]} />
                )}
              </View>
            );
          })}
        </View>

        <Text style={[styles.footerText, { color: ui.subText }]}>
          © 2026 True Juice. Mọi quyền được bảo lưu.
        </Text>
      </ScrollView>
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

  // Intro
  introCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 25,
  },
  introTextContainer: { flex: 1, marginLeft: 14 },
  introTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  introDesc: { fontSize: 13, lineHeight: 19 },

  // Sections
  sectionsCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 25,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  sectionLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  sectionTitle: { fontSize: 15, fontWeight: '700', flex: 1 },
  sectionContent: {
    paddingHorizontal: 18,
    paddingBottom: 18,
    borderTopWidth: 1,
    paddingTop: 12,
    marginHorizontal: 18,
  },
  sectionText: { fontSize: 14, lineHeight: 22 },

  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  divider: { height: 1, marginHorizontal: 18 },

  footerText: { fontSize: 12, textAlign: 'center', marginTop: 5 },
});

export default PrivacyScreen;
