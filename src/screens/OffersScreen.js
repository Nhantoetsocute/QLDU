import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Animated,
  StatusBar,
  ImageBackground,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, FontAwesome5, Feather } from '@expo/vector-icons';
import { useAppTheme } from '../theme/ThemeContext';

const { width } = Dimensions.get('window');
const ORANGE_COLOR = '#E57905';

// --- DỮ LIỆU VOUCHER CHÍNH XÁC NHƯ TRONG ẢNH ---
const mockVouchers = [
  {
    id: 'pv1',
    type: 'PRIVILEGE',
    discountDisplay: 'UPSIZE',
    title: 'Thành viên Gold: Miễn phí nâng size cho mọi đơn trà sữa',
    expiry: 'Hết hạn 30/06/2026',
    category: 'privilege',
  },
  {
    id: 'pv2',
    type: 'PRIVILEGE',
    discountDisplay: '2X BEAN',
    title: 'Nhân đôi điểm Bean cho đơn từ 120K vào Thứ 4',
    expiry: 'Hết hạn 31/12/2026',
    category: 'privilege',
  },
  {
    id: 'pv3',
    type: 'PRIVILEGE',
    discountDisplay: '15%',
    title: 'Ưu đãi hội viên: Giảm 15% combo đồ uống + bánh ngọt',
    expiry: 'Hết hạn 31/08/2026',
    category: 'privilege',
  },
  {
    id: '1',
    type: 'PICKUP',
    discountDisplay: '10%',
    title: 'Nhập mã GIAM10KM - Giảm 40% + FREESHIP Đơn từ 10 Ly (tối đa 500K)',
    expiry: 'Hết hạn 30/04/2025',
    category: 'takeaway',
  },
  {
    id: '2',
    type: 'DELIVERY',
    discountDisplay: '30K',
    title: 'Nhập mã GIAM30K - Giảm 30K Đơn Từ 99K',
    expiry: 'Hết hạn 30/04/2025',
    category: 'delivery',
  },
  {
    id: '3',
    type: 'DELIVERY',
    discountDisplay: '30% + FREESHIP',
    title: 'Nhập mã GIAM30KM - Giảm 30% + Freeship Đơn Từ 5 Ly',
    expiry: 'Hết hạn 30/04/2025',
    category: 'delivery',
  },
  {
    id: '4',
    type: 'DELIVERY',
    discountDisplay: 'MIỄN PHÍ GIAO HÀNG',
    title: 'Nhập mã GIAM20K - Giảm 20K Đơn Từ 60K',
    expiry: 'Hết hạn 30/04/2025',
    category: 'delivery',
  },
  {
    id: '5',
    type: 'DELIVERY',
    discountDisplay: 'MIỄN PHÍ VẬN CHUYỂN',
    title: 'Nhập mã FREESHIP - Miễn phí vận chuyển',
    expiry: 'Hết hạn 30/04/2025',
    category: 'delivery',
  },
  {
    id: 'rw1',
    type: 'REDEEM',
    discountDisplay: '500 BEAN',
    title: 'Đổi 500 Bean nhận 01 topping bất kỳ miễn phí',
    expiry: 'Số lượng có hạn',
    category: 'redeem',
  },
  {
    id: 'rw2',
    type: 'REDEEM',
    discountDisplay: '1200 BEAN',
    title: 'Đổi 1.200 Bean lấy bình giữ nhiệt True Juice',
    expiry: 'Hết hạn 30/09/2026',
    category: 'redeem',
  },
  {
    id: 'rw3',
    type: 'REDEEM',
    discountDisplay: '1800 BEAN',
    title: 'Đổi 1.800 Bean nhận voucher 100K dùng toàn hệ thống',
    expiry: 'Hết hạn 31/10/2026',
    category: 'redeem',
  },
];

const categories = [
  { id: 'privilege', name: 'Đặc quyền', icon: 'crown' },
  { id: 'delivery', name: 'Giao nhận', icon: 'bike' },
  { id: 'takeaway', name: 'Mang đi', icon: 'cup-outline' },
  { id: 'redeem', name: 'Đổi quà', icon: 'gift-outline' },
];

const OffersScreen = ({ navigation, route }) => {
  const [activeTab, setActiveTab] = useState('privilege');
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const { isDarkMode, colors } = useAppTheme();
  const accent = colors.accent || ORANGE_COLOR;

  const ui = {
    screenBg: colors.background,
    overlay: isDarkMode ? 'rgba(0,0,0,0.88)' : 'rgba(255,255,255,0.45)',
    headerBorder: isDarkMode ? 'rgba(212,175,55,0.15)' : 'rgba(184,134,11,0.2)',
    title: colors.text,
    pointsChipBg: isDarkMode ? 'rgba(212,175,55,0.15)' : 'rgba(184,134,11,0.12)',
    pointsChipBorder: isDarkMode ? 'rgba(212,175,55,0.3)' : 'rgba(184,134,11,0.25)',
    catBg: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.72)',
    catActiveBg: accent,
    catIcon: accent,
    catIconActive: isDarkMode ? '#1A1A1A' : '#FFFFFF',
    catText: colors.subText,
    catTextActive: isDarkMode ? '#1A1A1A' : '#FFFFFF',
    sectionTitle: colors.text,
    cardBg: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.82)',
    cardBorder: isDarkMode ? 'rgba(212,175,55,0.15)' : 'rgba(184,134,11,0.2)',
    thumbBg: isDarkMode ? 'rgba(212,175,55,0.15)' : 'rgba(184,134,11,0.12)',
    typeTagBg: isDarkMode ? 'rgba(0,0,0,0.8)' : 'rgba(17,24,39,0.85)',
    typeTagText: accent,
    discount: accent,
    voucherTitle: colors.text,
    voucherExpiry: colors.subText,
    emptyText: colors.subText,
  };

  useEffect(() => {
    const incomingCategory = route?.params?.category;
    if (!incomingCategory) return;
    setActiveTab(incomingCategory);
    fadeAnim.setValue(0);
  }, [route?.params?.category, fadeAnim]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [activeTab]);

  const renderVoucher = ({ item }) => (
    <Animated.View style={[styles.voucherWrapper, { opacity: fadeAnim }]}>
      <TouchableOpacity style={[styles.voucherCard, { backgroundColor: ui.cardBg, borderColor: ui.cardBorder }]} activeOpacity={0.8}>
        {/* Bên trái: Ảnh thu nhỏ (thumbnail) với loại dịch vụ và mức giảm */}
        <View style={[styles.thumbnailContainer, { backgroundColor: ui.thumbBg }]}>
          <View style={[styles.typeTag, { backgroundColor: ui.typeTagBg }]}>
            <Text style={[styles.typeTagText, { color: ui.typeTagText }]}>{item.type}</Text>
           </View>
          <Text style={[styles.discountTextBig, { color: ui.discount }]}>{item.discountDisplay}</Text>
        </View>
        
        {/* Bên phải: Thông tin phiếu */}
        <View style={styles.voucherInfo}>
          <Text style={[styles.voucherTitle, { color: ui.voucherTitle }]}>{item.title}</Text>
          <Text style={[styles.voucherExpiry, { color: ui.voucherExpiry }]}>{item.expiry}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <View style={[styles.container, { backgroundColor: ui.screenBg }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
      <ImageBackground 
        source={{ uri: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?q=80&w=800' }} 
        style={styles.bg}
      >
        <View style={[styles.overlay, { backgroundColor: ui.overlay }]} />
        
        <SafeAreaView style={{ flex: 1 }}>
          {/* HEADER */}
          <View style={[styles.header, { borderBottomColor: ui.headerBorder }]}>
            <Text style={[styles.headerTitle, { color: ui.title }]}>Ưu đãi độc quyền</Text>
            <View style={[styles.pointsChip, { backgroundColor: ui.pointsChipBg, borderColor: ui.pointsChipBorder }]}> 
              <FontAwesome5 name="coins" size={14} color={accent} />
              <Text style={[styles.pointsText, { color: accent }]}>1.250 Bean</Text>
            </View>
          </View>

          {/* 4 HẠNG MỤC (CATEGORIES) */}
          <View style={styles.catContainer}>
            {categories.map((cat) => (
              <TouchableOpacity 
                key={cat.id} 
                style={[
                  styles.catBtn,
                  { backgroundColor: ui.catBg },
                  activeTab === cat.id && [styles.catBtnActive, { backgroundColor: ui.catActiveBg }],
                ]}
                onPress={() => {
                  fadeAnim.setValue(0);
                  setActiveTab(cat.id);
                }}
              >
                <MaterialCommunityIcons 
                  name={cat.icon} 
                  size={24} 
                  color={activeTab === cat.id ? ui.catIconActive : ui.catIcon} 
                />
                <Text style={[styles.catText, { color: activeTab === cat.id ? ui.catTextActive : ui.catText }]}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* SẴN SÀNG SỬ DỤNG */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: ui.sectionTitle }]}>Sẵn sàng sử dụng</Text>
          </View>

          {/* DANH SÁCH VOUCHER */}
          <FlatList
            data={mockVouchers.filter(v => v.category === activeTab)}
            keyExtractor={(item) => item.id}
            renderItem={renderVoucher}
            contentContainerStyle={styles.listPadding}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
                <Text style={[styles.emptyText, { color: ui.emptyText }]}>Hiện chưa có ưu đãi trong mục này.</Text>
            }
          />
        </SafeAreaView>
      </ImageBackground>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  bg: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject },
  
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 20, 
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 10 : 10,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', letterSpacing: 1 },
  pointsChip: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 20,
    borderWidth: 1,
  },
  pointsText: { fontWeight: 'bold', marginLeft: 6, fontSize: 13 },

  catContainer: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    paddingHorizontal: 15, 
    marginVertical: 20, 
  },
  catBtn: { 
    alignItems: 'center', 
    width: (width - 60) / 4, 
    paddingVertical: 12, 
    borderRadius: 15,
  },
  catBtnActive: {},
  catText: { fontSize: 11, fontWeight: '700', marginTop: 6, textAlign: 'center' },

  sectionHeader: {
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },

  listPadding: { paddingHorizontal: 20, paddingBottom: 100 },
  voucherWrapper: { marginBottom: 15 },
  voucherCard: { 
    flexDirection: 'row', 
    borderRadius: 16, 
    padding: 12,
    borderWidth: 1, 
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  thumbnailContainer: {
    width: 60,
    height: 60,
    borderRadius: 12,
    marginRight: 15,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  typeTag: {
    position: 'absolute',
    top: 5,
    left: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeTagText: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  discountTextBig: {
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    paddingTop: 10, // Chừa chỗ cho type tag
  },
  voucherInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  voucherTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 4,
    lineHeight: 18,
  },
  voucherExpiry: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyText: { textAlign: 'center', marginTop: 50, fontStyle: 'italic' }
});

export default OffersScreen;