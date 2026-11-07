import React, { useState, useEffect } from 'react';
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
  Alert, Switch, Share, Modal, TextInput, ActivityIndicator, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../theme/ThemeContext';
import { useUserProfile } from '../context/UserProfileContext';
import { apiUrl } from '../config/api';
import { readAiConsent, setAiConsent, subscribeAiConsent, resetAiConsent } from '../services/aiConsent';
import { subscribePrivacyReset } from '../services/privacyStorage';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const privacySections = [
  {
    icon: 'person-outline', title: '1. Thông tin được xử lý',
    content: 'App xử lý tên, email, số điện thoại, địa chỉ, ảnh đại diện và đơn hàng để phục vụ tài khoản và giao dịch. Hồ sơ chỉ giữ trong bộ nhớ khi sử dụng app; token đăng nhập trên thiết bị được lưu trong SecureStore. Bản web chỉ giữ phiên trong bộ nhớ. Các bản lưu hồ sơ cũ trên thiết bị được xóa khi khởi động.',
  },
  {
    icon: 'lock-closed-outline', title: '2. Bảo vệ dữ liệu',
    content: 'Mật khẩu được băm bằng bcrypt. Bản phát hành yêu cầu HTTPS; bản phát triển có thể dùng HTTP trong mạng nội bộ. API kiểm tra tài khoản và quyền sở hữu dữ liệu. Không gửi mật khẩu, token hay thông tin thanh toán vào nội dung chat.',
  },
  {
    icon: 'share-social-outline', title: '3. Dịch vụ bên ngoài và AI',
    content: 'VNPay xử lý thông tin cần cho giao dịch; dịch vụ email gửi mã OTP. Khi bạn bật trợ lý AI, nội dung câu hỏi và lịch sử gần đây được gửi tới Google Gemini. Với dịch vụ miễn phí, Google có thể dùng nội dung để cải thiện sản phẩm theo điều khoản của họ. App lọc một số mẫu email, số điện thoại và khóa, nhưng không bảo đảm nhận diện mọi dữ liệu cá nhân. Không gửi dữ liệu nhạy cảm. Tắt AI sẽ ngăn yêu cầu mới và xóa lịch sử chat trong app; không thu hồi nội dung đã gửi tới nhà cung cấp.',
  },
  {
    icon: 'trash-outline', title: '4. Xuất dữ liệu và đóng tài khoản',
    content: 'Bạn có thể xuất hồ sơ, đơn hàng và dữ liệu gắn với tài khoản bằng nút bên dưới. Đóng tài khoản cần mật khẩu hiện tại và không được thực hiện khi còn đơn đang xử lý hoặc thanh toán cần đối soát. Khi đóng, tài khoản bị vô hiệu hóa, phiên bị thu hồi và thông tin cá nhân được ẩn danh. Mã giao dịch, số tiền và dữ liệu kế toán được giữ để đối soát. Thao tác này không xóa bản sao bạn đã xuất hoặc nội dung đã gửi tới dịch vụ bên ngoài.',
  },
  {
    icon: 'phone-portrait-outline', title: '5. Dữ liệu trên thiết bị',
    content: 'App lưu giỏ hàng theo tài khoản, lựa chọn ngôn ngữ, giao diện, tùy chọn thông báo và lựa chọn sử dụng AI. Khi đăng xuất, app xóa dữ liệu giỏ hàng của tài khoản, lịch sử chat, đặt bàn tạm và lựa chọn AI. Các tùy chọn giao diện, ngôn ngữ và thông báo được giữ lại. App không tích hợp công cụ quảng cáo theo dõi trong mã hiện tại.',
  },
  {
    icon: 'refresh-outline', title: '6. Phiên bản thông báo',
    content: 'Cập nhật ngày 07/11/2026. Khi cách chia sẻ nội dung AI thay đổi, app yêu cầu đồng ý lại theo phiên bản thông báo mới. Những lựa chọn dưới đây áp dụng cho app và thiết bị đang sử dụng.',
  },
];

const PrivacyScreen = ({ navigation }) => {
  const { isDarkMode, colors } = useAppTheme();
  const [expandedIndex, setExpandedIndex] = useState(null);
  const { token, logoutContext } = useUserProfile();
  const [aiAllowed, setAiAllowed] = useState(false);
  const [working, setWorking] = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [password, setPassword] = useState('');

  useEffect(() => {
    const off = subscribeAiConsent(setAiAllowed);
    const offReset = subscribePrivacyReset(() => resetAiConsent());
    readAiConsent().catch(() => setAiAllowed(false));
    return () => { off(); offReset(); };
  }, []);

  const changeAiConsent = async (allowed) => {
    try { await setAiConsent(allowed); }
    catch {
      await setAiConsent(false).catch(() => {});
      Alert.alert('Chưa lưu được lựa chọn', 'Trợ lý AI đã tắt. Vui lòng thử lại.');
    }
  };
  const exportData = async () => {
    if (!token || working) return;
    setWorking(true);
    try {
      const response = await fetch(apiUrl('/api/privacy/export'), {headers:{Authorization:`Bearer ${token}`}});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || data.message || 'Chưa thể xuất dữ liệu.');
      const content = JSON.stringify(data,null,2);
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const url = URL.createObjectURL(new Blob([content],{type:'application/json'}));
        const link = document.createElement('a');
        link.href = url; link.download = 'true-juice-personal-data.json';
        document.body.appendChild(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url),1000);
      } else {
        await Share.share({title:'Dữ liệu cá nhân True Juice',message:content});
      }
    } catch (error) { Alert.alert('Xuất dữ liệu',error.message || 'Chưa thể xuất dữ liệu.'); }
    finally { setWorking(false); }
  };
  const closeAccount = async () => {
    if (!token || !password || working) return;
    setWorking(true);
    try {
      const response = await fetch(apiUrl('/api/privacy/delete-account'), {
        method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
        body:JSON.stringify({password}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || data.message || 'Chưa thể đóng tài khoản.');
      setPassword(''); setDeleteVisible(false);
      await setAiConsent(false).catch(() => {});
      await logoutContext().catch(() => Alert.alert('Dữ liệu trên thiết bị', 'Tài khoản đã đóng. Chưa xóa hết dữ liệu trên thiết bị; hãy xóa dữ liệu ứng dụng trước khi chuyển thiết bị cho người khác.'));
      if (data.avatarCleanupPending) Alert.alert('Đã đóng tài khoản', 'Một số ảnh đại diện đang chờ máy chủ dọn dẹp.');
      // Closing the session unmounts the authenticated navigation tree.
    } catch (error) { setPassword(''); Alert.alert('Đóng tài khoản',error.message || 'Chưa thể đóng tài khoản.'); }
    finally { setWorking(false); }
  };

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

        <View style={[styles.introCard, {backgroundColor:ui.card,borderColor:ui.cardBorder,flexDirection:'column',alignItems:'stretch'}]}>
          <Text style={[styles.introTitle,{color:ui.text}]}>Lựa chọn dữ liệu của bạn</Text>
          <Text style={[styles.sectionText,{color:ui.subText,marginTop:10}]}>Cho phép gửi câu hỏi và lịch sử chat gần đây tới Google Gemini. Dịch vụ miễn phí có thể dùng nội dung để cải thiện sản phẩm. Không gửi thông tin nhạy cảm.</Text>
          <Switch accessibilityLabel="Cho phép gửi nội dung tới Gemini" value={aiAllowed} onValueChange={changeAiConsent} />
          <TouchableOpacity onPress={() => Linking.openURL('https://ai.google.dev/gemini-api/terms').catch(() => Alert.alert('Không mở được liên kết'))} style={{paddingVertical:10}}>
            <Text style={{color:ui.accent}}>Điều khoản xử lý dữ liệu của Gemini</Text>
          </TouchableOpacity>
          <Text style={[styles.sectionText,{color:ui.subText}]}>Bản xuất có thông tin cá nhân. Hãy chọn nơi lưu hoặc chia sẻ mà bạn tin cậy.</Text>
          <TouchableOpacity accessibilityRole="button" disabled={!token || working} onPress={exportData} style={{paddingVertical:14,opacity:token && !working ? 1 : 0.5}}>
            <Text style={{color:ui.accent,fontWeight:'700'}}>Xuất dữ liệu của tôi</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" disabled={!token || working} onPress={() => setDeleteVisible(true)} style={{paddingVertical:14,opacity:token && !working ? 1 : 0.5}}>
            <Text style={{color:'#c94e4e',fontWeight:'700'}}>Đóng tài khoản và ẩn danh dữ liệu</Text>
          </TouchableOpacity>
          {!token && <Text style={{color:ui.subText}}>Đăng nhập để xuất dữ liệu hoặc đóng tài khoản.</Text>}
          {working && <ActivityIndicator color={ui.accent} />}
        </View>

        <Text style={[styles.footerText, { color: ui.subText }]}>
          © 2026 True Juice. Mọi quyền được bảo lưu.
        </Text>
      </ScrollView>
      <Modal visible={deleteVisible} transparent animationType="fade" onRequestClose={() => {if(!working){setDeleteVisible(false);setPassword('');}}}>
        <View style={{flex:1,backgroundColor:'rgba(0,0,0,0.6)',justifyContent:'center',padding:24}}>
          <View style={{backgroundColor:ui.bg,borderRadius:16,padding:20}}>
            <Text style={[styles.introTitle,{color:ui.text}]}>Xác nhận đóng tài khoản</Text>
            <Text style={[styles.sectionText,{color:ui.subText,marginVertical:12}]}>Thao tác này không thể khôi phục. Thông tin cá nhân sẽ được ẩn danh; số tiền, mã giao dịch và dữ liệu kế toán vẫn được giữ để đối soát. Cần xử lý xong các đơn và thanh toán đang chờ trước khi đóng.</Text>
            <TextInput accessibilityLabel="Mật khẩu hiện tại" placeholder="Mật khẩu hiện tại" placeholderTextColor={ui.subText} secureTextEntry autoCapitalize="none" autoCorrect={false} maxLength={256} value={password} onChangeText={setPassword} editable={!working} style={{color:ui.text,borderColor:ui.cardBorder,borderWidth:1,borderRadius:10,padding:14}} />
            <TouchableOpacity disabled={!password || working} onPress={closeAccount} style={{paddingVertical:16,opacity:password && !working ? 1 : 0.5}}>
              <Text style={{color:'#c94e4e',fontWeight:'700'}}>Xác nhận đóng tài khoản</Text>
            </TouchableOpacity>
            <TouchableOpacity disabled={working} onPress={() => {setDeleteVisible(false);setPassword('');}} style={{paddingVertical:12}}>
              <Text style={{color:ui.accent}}>Hủy</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
