import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
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

const termsSections = [
  {
    icon: 'document-text-outline',
    title: '1. Điều khoản chung',
    content: 'Khi sử dụng ứng dụng True Juice, bạn đồng ý tuân thủ các điều khoản và điều kiện sau đây. Nếu bạn không đồng ý với bất kỳ điều khoản nào, vui lòng ngừng sử dụng ứng dụng.\n\n• True Juice có quyền thay đổi điều khoản bất cứ lúc nào\n• Người dùng phải từ 16 tuổi trở lên\n• Mỗi người chỉ được đăng ký một tài khoản',
  },
  {
    icon: 'cart-outline',
    title: '2. Chính sách đặt hàng',
    content: '• Giá hiển thị trên ứng dụng đã bao gồm VAT\n• Đơn hàng được xác nhận khi bạn nhận được thông báo từ hệ thống\n• True Juice có quyền từ chối đơn hàng nếu sản phẩm hết hàng hoặc có dấu hiệu bất thường\n• Đơn hàng tối thiểu: 30.000đ (không áp dụng cho đơn tại quán)',
  },
  {
    icon: 'card-outline',
    title: '3. Thanh toán',
    content: 'True Juice hỗ trợ các phương thức thanh toán:\n\n• COD (Thanh toán khi nhận hàng): Trả tiền mặt cho shipper\n• VNPAY: Thanh toán qua ví điện tử, QR code hoặc thẻ ngân hàng\n\nMọi giao dịch VNPAY được bảo mật theo tiêu chuẩn PCI DSS.',
  },
  {
    icon: 'bicycle-outline',
    title: '4. Giao nhận hàng',
    content: '• Phí giao hàng tính theo khoảng cách từ cửa hàng gần nhất\n• Thời gian giao hàng ước tính: 15–45 phút\n• Nếu đơn hàng giao trễ hơn 60 phút, bạn được miễn phí ship đơn tiếp theo\n• Shipper sẽ gọi điện trước khi giao để xác nhận',
  },
  {
    icon: 'refresh-outline',
    title: '5. Đổi trả & Hoàn tiền',
    content: 'True Juice cam kết đổi/trả trong các trường hợp:\n\n• Sản phẩm bị hỏng hoặc sai đơn → Đổi mới 100%\n• Đơn hàng giao nhầm → Hoàn tiền hoặc giao lại miễn phí\n• Khách hàng tự hủy sau khi đã pha chế → Không hoàn tiền\n\nThời gian hoàn tiền VNPAY: 3–5 ngày làm việc.',
  },
  {
    icon: 'gift-outline',
    title: '6. Chương trình ưu đãi',
    content: '• Voucher có điều kiện về giá trị đơn tối thiểu và thời hạn sử dụng\n• Mỗi đơn hàng chỉ áp dụng 1 mã voucher\n• True Juice có quyền thu hồi voucher nếu phát hiện lạm dụng\n• Điểm tích lũy không được quy đổi thành tiền mặt',
  },
  {
    icon: 'ban-outline',
    title: '7. Hành vi bị cấm',
    content: '• Giả mạo thông tin khi đăng ký tài khoản\n• Lạm dụng hệ thống voucher / khuyến mãi\n• Đặt hàng với mục đích gây rối hoặc lừa đảo\n• Tấn công, can thiệp vào hệ thống backend\n\nVi phạm sẽ bị khóa tài khoản vĩnh viễn.',
  },
  {
    icon: 'alert-circle-outline',
    title: '8. Giới hạn trách nhiệm',
    content: 'True Juice không chịu trách nhiệm cho:\n\n• Thiệt hại do lỗi mạng hoặc thiết bị người dùng\n• Chậm trễ giao hàng do điều kiện thời tiết hoặc giao thông\n• Phản ứng dị ứng do người dùng không khai báo\n\nTrong mọi trường hợp, mức bồi thường tối đa bằng giá trị đơn hàng.',
  },
];

const TermsScreen = ({ navigation }) => {
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
        <Text style={[styles.headerTitle, { color: ui.text }]}>Điều khoản dịch vụ</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* INTRO */}
        <View style={[styles.introCard, { backgroundColor: 'rgba(212,175,55,0.08)', borderColor: 'rgba(212,175,55,0.2)' }]}>
          <Ionicons name="document-text" size={24} color={ui.accent} />
          <View style={styles.introTextContainer}>
            <Text style={[styles.introTitle, { color: ui.text }]}>Điều khoản sử dụng</Text>
            <Text style={[styles.introDesc, { color: ui.subText }]}>
              Vui lòng đọc kỹ trước khi sử dụng dịch vụ True Juice.
            </Text>
          </View>
        </View>

        {/* SECTIONS */}
        <View style={[styles.sectionsCard, { backgroundColor: ui.card, borderColor: ui.cardBorder }]}>
          {termsSections.map((section, index) => {
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

                {index < termsSections.length - 1 && (
                  <View style={[styles.divider, { backgroundColor: ui.divider }]} />
                )}
              </View>
            );
          })}
        </View>

        <Text style={[styles.footerText, { color: ui.subText }]}>
          Có hiệu lực từ ngày 01/01/2026{'\n'}© 2026 True Juice. Mọi quyền được bảo lưu.
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
  footerText: { fontSize: 12, textAlign: 'center', marginTop: 5, lineHeight: 20 },
});

export default TermsScreen;
