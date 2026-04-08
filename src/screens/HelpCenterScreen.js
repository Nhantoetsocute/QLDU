import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Keyboard,
  StatusBar,
  ScrollView,
  Linking,
  TextInput,
  Alert,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../theme/ThemeContext';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const faqItems = [
  {
    question: 'Làm sao để đặt hàng trên True Juice?',
    answer: 'Bạn chỉ cần chọn sản phẩm yêu thích từ Trang Chủ hoặc mục Tất cả sản phẩm, thêm vào giỏ hàng, sau đó nhấn "Thanh toán" để hoàn tất đơn hàng. Bạn có thể chọn COD hoặc VNPAY.',
  },
  {
    question: 'Tôi có thể hủy đơn hàng không?',
    answer: 'Bạn có thể hủy đơn hàng khi trạng thái còn "Đang chuẩn bị". Sau khi shipper đã nhận đơn, việc hủy sẽ cần liên hệ Hotline 1900 6868 để được hỗ trợ.',
  },
  {
    question: 'Thời gian giao hàng là bao lâu?',
    answer: 'Thời gian giao hàng trung bình từ 15–30 phút tùy khoảng cách. Trong giờ cao điểm (11:00–13:00 và 17:00–19:00), thời gian có thể lâu hơn 10–15 phút.',
  },
  {
    question: 'Làm sao để sử dụng mã giảm giá?',
    answer: 'Khi thanh toán, nhập mã voucher vào ô "Mã giảm giá" và nhấn "Áp dụng". Hệ thống sẽ tự động tính giảm giá nếu mã hợp lệ và đơn hàng đạt giá trị tối thiểu.',
  },
  {
    question: 'Tôi quên mật khẩu thì sao?',
    answer: 'Tại màn hình Đăng nhập, nhấn "Quên mật khẩu?". Nhập email đã đăng ký, hệ thống sẽ gửi mã OTP để bạn đặt lại mật khẩu mới.',
  },
  {
    question: 'Làm sao để đặt bàn trước tại cửa hàng?',
    answer: 'Vào tab "Cửa Hàng", chọn chi nhánh, chọn khung giờ và bàn trống. Thanh toán cọc qua VNPAY để hoàn tất đặt bàn. Bạn có thể hủy đặt bàn bất cứ lúc nào.',
  },
];

const contactMethods = [
  {
    icon: 'call-outline',
    iconType: 'ionicon',
    title: 'Hotline',
    value: '1900 6868',
    action: () => Linking.openURL('tel:19006868'),
    color: '#2ECC71',
  },
  {
    icon: 'mail-outline',
    iconType: 'ionicon',
    title: 'Email',
    value: 'support@truejuice.vn',
    action: () => Linking.openURL('mailto:support@truejuice.vn'),
    color: '#3498DB',
  },
  {
    icon: 'chatbubble-ellipses-outline',
    iconType: 'ionicon',
    title: 'Zalo',
    value: 'True Juice Official',
    action: () => Linking.openURL('https://zalo.me/truejuice'),
    color: '#0068FF',
  },
  {
    icon: 'logo-facebook',
    iconType: 'ionicon',
    title: 'Facebook',
    value: 'fb.com/truejuice.vn',
    action: () => Linking.openURL('https://fb.com/truejuice.vn'),
    color: '#1877F2',
  },
];

const HelpCenterScreen = ({ navigation }) => {
  const { isDarkMode, colors } = useAppTheme();
  const [expandedFaq, setExpandedFaq] = useState(null);
  const [feedback, setFeedback] = useState('');

  const ui = {
    bg: colors.background,
    card: isDarkMode ? 'rgba(255,255,255,0.05)' : '#FFFFFF',
    cardBorder: isDarkMode ? 'rgba(212,175,55,0.15)' : 'rgba(0,0,0,0.06)',
    text: colors.text,
    subText: colors.subText,
    accent: colors.accent,
    divider: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    inputBg: isDarkMode ? 'rgba(255,255,255,0.06)' : '#F5F5F5',
  };

  const toggleFaq = (index) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedFaq(expandedFaq === index ? null : index);
  };

  const handleSendFeedback = () => {
    if (!feedback.trim()) {
      Alert.alert('Thông báo', 'Vui lòng nhập nội dung góp ý.');
      return;
    }
    Alert.alert('Cảm ơn bạn!', 'Góp ý của bạn đã được gửi đến đội ngũ True Juice. Chúng tôi sẽ phản hồi sớm nhất!\n\n♥ True Juice');
    setFeedback('');
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <SafeAreaView style={[styles.container, { backgroundColor: ui.bg }]}> 
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={28} color={ui.accent} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: ui.text }]}>Trung tâm trợ giúp</Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
        {/* CONTACT METHODS */}
        <Text style={[styles.sectionLabel, { color: ui.subText }]}>LIÊN HỆ HỖ TRỢ</Text>
        <View style={styles.contactGrid}>
          {contactMethods.map((method, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.contactCard, { backgroundColor: ui.card, borderColor: ui.cardBorder }]}
              onPress={method.action}
              activeOpacity={0.7}
            >
              <View style={[styles.contactIconBox, { backgroundColor: `${method.color}18` }]}>
                <Ionicons name={method.icon} size={22} color={method.color} />
              </View>
              <Text style={[styles.contactTitle, { color: ui.text }]}>{method.title}</Text>
              <Text style={[styles.contactValue, { color: ui.subText }]} numberOfLines={1}>{method.value}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* HOURS */}
        <View style={[styles.hoursCard, { backgroundColor: 'rgba(212,175,55,0.08)', borderColor: 'rgba(212,175,55,0.2)' }]}>
          <Ionicons name="time-outline" size={20} color={ui.accent} />
          <Text style={[styles.hoursText, { color: ui.subText }]}>
            Giờ hỗ trợ: <Text style={{ color: ui.accent, fontWeight: '700' }}>08:00 – 22:00</Text> hàng ngày (kể cả Lễ, Tết)
          </Text>
        </View>

        {/* FAQ */}
        <Text style={[styles.sectionLabel, { color: ui.subText }]}>CÂU HỎI THƯỜNG GẶP</Text>
        <View style={[styles.faqCard, { backgroundColor: ui.card, borderColor: ui.cardBorder }]}>
          {faqItems.map((faq, index) => {
            const isExpanded = expandedFaq === index;
            return (
              <View key={index}>
                <TouchableOpacity
                  style={styles.faqRow}
                  onPress={() => toggleFaq(index)}
                  activeOpacity={0.7}
                >
                  <View style={styles.faqLeft}>
                    <View style={[styles.faqBadge, { backgroundColor: isExpanded ? 'rgba(212,175,55,0.15)' : 'rgba(128,128,128,0.08)' }]}>
                      <Text style={[styles.faqBadgeText, { color: isExpanded ? ui.accent : ui.subText }]}>
                        {String(index + 1).padStart(2, '0')}
                      </Text>
                    </View>
                    <Text style={[styles.faqQuestion, { color: isExpanded ? ui.accent : ui.text }]}>
                      {faq.question}
                    </Text>
                  </View>
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={ui.subText}
                  />
                </TouchableOpacity>
                {isExpanded && (
                  <View style={[styles.faqAnswer, { borderTopColor: ui.divider }]}>
                    <Text style={[styles.faqAnswerText, { color: ui.subText }]}>{faq.answer}</Text>
                  </View>
                )}
                {index < faqItems.length - 1 && (
                  <View style={[styles.divider, { backgroundColor: ui.divider }]} />
                )}
              </View>
            );
          })}
        </View>

        {/* FEEDBACK FORM */}
        <Text style={[styles.sectionLabel, { color: ui.subText }]}>GỬI GÓP Ý</Text>
        <View style={[styles.feedbackCard, { backgroundColor: ui.card, borderColor: ui.cardBorder }]}>
          <TextInput
            style={[styles.feedbackInput, { backgroundColor: ui.inputBg, color: ui.text }]}
            placeholder="Nhập góp ý, phản hồi hoặc câu hỏi của bạn..."
            placeholderTextColor={ui.subText}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            value={feedback}
            onChangeText={setFeedback}
          />
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: ui.accent }]}
            onPress={handleSendFeedback}
            activeOpacity={0.8}
          >
            <Ionicons name="send" size={18} color="#1A1A1A" />
            <Text style={styles.sendBtnText}>Gửi góp ý</Text>
          </TouchableOpacity>
        </View>
        </ScrollView>
      </SafeAreaView>
    </TouchableWithoutFeedback>
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

  sectionLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 12,
    marginLeft: 5,
  },

  // Contact grid
  contactGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  contactCard: {
    width: '48%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  contactIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  contactTitle: { fontSize: 14, fontWeight: '700', marginBottom: 3 },
  contactValue: { fontSize: 12, textAlign: 'center' },

  // Hours
  hoursCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 25,
  },
  hoursText: { fontSize: 13, marginLeft: 12, flex: 1, lineHeight: 20 },

  // FAQ
  faqCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 25,
  },
  faqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  faqLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 },
  faqBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  faqBadgeText: { fontSize: 13, fontWeight: '800' },
  faqQuestion: { fontSize: 14, fontWeight: '600', flex: 1, lineHeight: 20 },
  faqAnswer: {
    paddingHorizontal: 18,
    paddingBottom: 16,
    paddingTop: 10,
    marginHorizontal: 18,
    borderTopWidth: 1,
  },
  faqAnswerText: { fontSize: 13, lineHeight: 21 },
  divider: { height: 1, marginHorizontal: 18 },

  // Feedback
  feedbackCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    marginBottom: 20,
  },
  feedbackInput: {
    borderRadius: 14,
    padding: 14,
    fontSize: 14,
    minHeight: 100,
    marginBottom: 14,
    lineHeight: 21,
  },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 14,
  },
  sendBtnText: {
    color: '#1A1A1A',
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 8,
  },
});

export default HelpCenterScreen;
