import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  FlatList,
  TouchableOpacity,
  Image,
  Animated,
  StatusBar,
  ImageBackground,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme/ThemeContext';

// --- NGHIỆP VỤ: DỮ LIỆU MẪU ĐƯỢC MỞ RỘNG ---
const orderTabs = [
  { id: 'all', name: 'Tất cả' },
  { id: 'preparing', name: 'Đang chuẩn bị' },
  { id: 'shipping', name: 'Đang giao' },
  { id: 'delivered', name: 'Đã giao' },
  { id: 'cancelled', name: 'Đã hủy' },
];

const mockOrders = [
  {
    id: 'TJ-8899',
    date: '15:30 • 12/10/2023',
    status: 'shipping',
    type: 'Delivery', // Hình thức
    total: '215.000 đ',
    itemCount: 3,
    mainItem: 'Trà đào cam xả',
    payment: 'Đã thanh toán (Ví True Juice)',
    address: '28 Nguyễn Huệ, Q.1, TP.HCM',
    image: require('../../assets/images/tra_cam_xa.jpg'),
  },
  {
    id: 'TJ-8898',
    date: '09:15 • 12/10/2023',
    status: 'preparing',
    type: 'Takeaway',
    total: '85.000 đ',
    itemCount: 1,
    mainItem: 'Cold Brew Thượng Hạng',
    payment: 'Thanh toán khi nhận',
    pickupCode: 'A-12',
    image: require('../../assets/images/cold_brew.jpg'),
  },
  {
    id: 'TJ-8850',
    date: '14:20 • 10/10/2023',
    status: 'delivered',
    type: 'Dine-in',
    total: '350.000 đ',
    itemCount: 4,
    mainItem: 'Nước ép rau má',
    payment: 'Đã thanh toán (Thẻ)',
    table: 'Bàn VIP 05',
    image: require('../../assets/images/rauma.jpg'),
  },
  {
    id: 'TJ-8842',
    date: '08:00 • 05/10/2023',
    status: 'cancelled',
    type: 'Delivery',
    total: '95.000 đ',
    itemCount: 2,
    mainItem: 'Trà chanh',
    payment: 'Đã hoàn tiền',
    address: '12 Lê Lợi, Q.1, TP.HCM',
    cancelReason: 'Hủy theo yêu cầu khách hàng',
    image: require('../../assets/images/tra_chanh.webp'),
  },
];

// --- HÀM NGHIỆP VỤ ---
const getStatusConfig = (status) => {
  switch (status) {
    case 'preparing': return { color: '#F39C12', text: 'Đang chuẩn bị', dot: '#F1C40F' };
    case 'shipping': return { color: '#3498DB', text: 'Shipper đang giao', dot: '#5DADE2' };
    case 'delivered': return { color: '#2ECC71', text: 'Đã hoàn thành', dot: '#27AE60' };
    case 'cancelled': return { color: '#E74C3C', text: 'Đã hủy', dot: '#C0392B' };
    default: return { color: '#95A5A6', text: 'Không xác định', dot: '#7F8C8D' };
  }
};

const getTypeIcon = (type) => {
  switch (type) {
    case 'Delivery': return 'bike';
    case 'Takeaway': return 'shopping-outline';
    case 'Dine-in': return 'silverware-fork-knife';
    default: return 'help';
  }
};

const getTypeLabel = (type) => {
  switch (type) {
    case 'Delivery': return 'Giao tận nơi';
    case 'Takeaway': return 'Mang đi';
    case 'Dine-in': return 'Dùng tại quán';
    default: return 'Khác';
  }
};

const OrderHistoryScreen = ({ navigation, route }) => {
  const { isDarkMode, colors } = useAppTheme();
  const ui = {
    cardBg: isDarkMode ? 'rgba(255, 255, 255, 0.04)' : 'rgba(248, 250, 252, 0.92)',
    cardBorder: isDarkMode ? 'rgba(212, 175, 55, 0.15)' : 'rgba(184, 134, 11, 0.24)',
    softBorder: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(17, 24, 39, 0.08)',
    textPrimary: isDarkMode ? '#FFFFFF' : '#111827',
    textSecondary: isDarkMode ? '#A9A9A9' : '#4B5563',
    textMuted: isDarkMode ? '#888' : '#6B7280',
    tabText: isDarkMode ? '#666' : '#6B7280',
    tabBg: isDarkMode ? 'transparent' : 'rgba(255,255,255,0.65)',
    statusBg: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.8)',
    actionBg: isDarkMode ? 'rgba(212, 175, 55, 0.05)' : 'rgba(184, 134, 11, 0.08)',
    actionBorder: isDarkMode ? 'rgba(212, 175, 55, 0.3)' : 'rgba(184, 134, 11, 0.32)',
  };

  const [activeTab, setActiveTab] = useState('all');
  const [orders, setOrders] = useState(mockOrders);
  
  // Animation mượt mà hơn với translateY
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(20);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true })
    ]).start();
  }, [activeTab]);

  useEffect(() => {
    const newOrder = route?.params?.newOrder;
    if (!newOrder) return;

    const uniqueOrder = {
      ...newOrder,
      id: `${newOrder.id}-${Date.now()}`,
    };

    setOrders((prev) => [uniqueOrder, ...prev]);
  }, [route?.params?.newOrder]);

  // Lọc nghiệp vụ: Tab Lịch sử hiển thị cả Delivered và Cancelled
  const filteredOrders = orders.filter(order => {
    if (activeTab === 'all') return true;
    return order.status === activeTab;
  });

  const renderOrderCard = ({ item }) => {
    const statusConfig = getStatusConfig(item.status);
    const typeIcon = getTypeIcon(item.type);
    const typeLabel = getTypeLabel(item.type);

    const openTracking = () => {
      navigation.navigate('OrderTracking', {
        orderId: item.id,
        status: item.status,
        type: item.type,
        total: item.total,
        payment: item.payment,
        mainItem: item.mainItem,
      });
    };

    return (
      <TouchableOpacity 
        style={[styles.orderCard, { backgroundColor: ui.cardBg, borderColor: ui.cardBorder }]} 
        activeOpacity={0.9}
        onPress={openTracking}
      >
        {/* Header Card: Icon Hình thức, Trạng thái */}
        <View style={[styles.cardHeader, { borderBottomColor: ui.softBorder }] }>
          <View style={styles.typeBadge}>
             <MaterialCommunityIcons name={typeIcon} size={16} color={ui.textSecondary} />
             <Text style={[styles.typeText, { color: ui.textSecondary }]}>{typeLabel}</Text>
          </View>

          <View style={[styles.statusIndicator, { backgroundColor: ui.statusBg }]}>
            <View style={[styles.statusDot, { backgroundColor: statusConfig.dot }]} />
            <Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.text}</Text>
          </View>
        </View>

        {/* Body Card: Thông tin món */}
        <View style={styles.cardBody}>
          <Image source={typeof item.image === 'string' ? { uri: item.image } : item.image} style={styles.orderImage} />
          <View style={styles.orderInfo}>
            <View style={styles.titleRow}>
               <Text style={[styles.mainItemName, { color: ui.textPrimary }]} numberOfLines={1}>{item.mainItem}</Text>
               <Text style={[styles.itemCount, { color: ui.textMuted }]}>({item.itemCount} món)</Text>
            </View>
            <Text style={[styles.orderDate, { color: ui.textMuted }]}>{item.date}</Text>
            <Text style={[styles.orderSubInfo, { color: ui.textSecondary }]} numberOfLines={1}>
              {item.type === 'Delivery' ? `📍 ${item.address}` : item.type === 'Takeaway' ? `🎫 Mã nhận: ${item.pickupCode}` : `🍽️ ${item.table}`}
            </Text>
            <Text style={[styles.orderSubInfo, { color: ui.textSecondary }]} numberOfLines={1}>💳 {item.payment}</Text>
            
            <View style={styles.priceRow}>
                <Text style={styles.orderTotal}>{item.total}</Text>
                <Text style={[styles.orderIdText, { color: ui.textMuted }]}>#{item.id}</Text>
            </View>
          </View>
        </View>

        {/* Footer Card: Nút Nghiệp vụ thông minh */}
        <View style={styles.cardFooter}>
           {item.status === 'delivered' || item.status === 'cancelled' ? (
              <TouchableOpacity
                style={[styles.actionButton, styles.reorderButton, { borderColor: colors.accent }]}
               onPress={openTracking}
              >
                 <Ionicons name="document-text-outline" size={16} color="#0A0A0A" />
                 <Text style={styles.reorderText}>XEM CHI TIẾT ĐƠN</Text>
              </TouchableOpacity>
           ) : (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: ui.actionBg, borderColor: ui.actionBorder }]}
               onPress={openTracking}
              >
                  <Text style={[styles.actionButtonText, { color: colors.accent }]}>THEO DÕI ĐƠN</Text>
                  <Feather name="arrow-right" size={16} color={colors.accent} />
              </TouchableOpacity>
           )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }] }>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
      
      <ImageBackground
        source={{ uri: 'https://images.unsplash.com/photo-1514432324607-a2c522b4ae12?q=80&w=800' }}
        style={styles.backgroundImage}
      >
        <View style={[styles.overlay, { backgroundColor: colors.overlay }]} />

        <SafeAreaView style={{ flex: 1 }}>
          {/* HEADER */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-back" size={28} color="#D4AF37" />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: ui.textPrimary }]}>Đơn Hàng Của Bạn</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* TABS TRẠNG THÁI */}
          <View style={styles.tabsContainer}>
            <FlatList
              data={orderTabs}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingHorizontal: 20 }}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={[
                    styles.tabButton,
                    { backgroundColor: ui.tabBg },
                    activeTab === item.id && styles.tabButtonActive,
                  ]}
                  onPress={() => setActiveTab(item.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.tabText, { color: ui.tabText }, activeTab === item.id && styles.tabTextActive]}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>

          {/* DANH SÁCH ĐƠN HÀNG */}
          <Animated.FlatList
            data={filteredOrders}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
            renderItem={renderOrderCard}
            ListEmptyComponent={() => (
              <View style={styles.emptyContainer}>
                <Ionicons name="receipt-outline" size={60} color="rgba(212, 175, 55, 0.3)" />
                <Text style={[styles.emptyTitle, { color: ui.textPrimary }]}>Chưa có giao dịch</Text>
                <Text style={[styles.emptyText, { color: ui.textMuted }]}>Những ly cà phê tuyệt hảo đang chờ bạn khám phá.</Text>
                <TouchableOpacity style={styles.orderNowBtn} onPress={() => navigation.navigate('AllProducts')}>
                    <Text style={styles.orderNowText}>BẮT ĐẦU ĐẶT HÀNG</Text>
                </TouchableOpacity>
              </View>
            )}
          />
        </SafeAreaView>
      </ImageBackground>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A' },
  backgroundImage: { flex: 1, resizeMode: 'cover' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15, 15, 15, 0.92)' }, // Tối và mịn hơn
  
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingTop: Platform.OS === 'android' ? 20 : 10,
    paddingBottom: 20,
  },
  backButton: { padding: 5 },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 0.5,
  },

  // Tabs
  tabsContainer: {
    marginBottom: 20,
  },
  tabButton: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 15,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: '#D4AF37',
  },
  tabText: {
    color: '#666',
    fontSize: 15,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#D4AF37',
    fontWeight: 'bold',
  },

  // List
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 100, 
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
  },
  emptyText: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 30,
  },
  orderNowBtn: {
      backgroundColor: '#D4AF37',
      paddingHorizontal: 25,
      paddingVertical: 12,
      borderRadius: 12,
  },
  orderNowText: {
      color: '#0A0A0A',
      fontWeight: 'bold',
      letterSpacing: 1,
  },

  // Order Card (Premium Design)
  orderCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.15)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  typeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
  },
  typeText: {
      color: '#A9A9A9',
      fontSize: 13,
      fontWeight: '500',
      marginLeft: 6,
  },
  statusIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.05)',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
  },
  statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      marginRight: 6,
  },
  statusText: {
      fontSize: 12,
      fontWeight: '600',
  },
  cardBody: {
    flexDirection: 'row',
    padding: 18,
  },
  orderImage: {
    width: 65,
    height: 65,
    borderRadius: 16,
    marginRight: 15,
  },
  orderInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  titleRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      marginBottom: 4,
  },
  mainItemName: {
      color: '#FFF',
      fontSize: 16,
      fontWeight: '700',
      flexShrink: 1,
      marginRight: 5,
  },
  itemCount: {
      color: '#888',
      fontSize: 13,
  },
  orderDate: {
    color: '#888',
    fontSize: 12,
    marginBottom: 6,
  },
  orderSubInfo: {
    fontSize: 12,
    marginBottom: 4,
  },
  priceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
  },
  orderTotal: {
    color: '#D4AF37',
    fontWeight: 'bold',
    fontSize: 16,
  },
  orderIdText: {
      color: '#555',
      fontSize: 12,
  },
  cardFooter: {
    paddingHorizontal: 18,
    paddingBottom: 18,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.05)',
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  actionButtonText: {
    color: '#D4AF37',
    fontSize: 13,
    fontWeight: 'bold',
    marginRight: 8,
    letterSpacing: 1,
  },
  reorderButton: {
      backgroundColor: '#D4AF37',
      borderColor: '#D4AF37',
  },
  reorderText: {
      color: '#0A0A0A',
      fontSize: 13,
      fontWeight: 'bold',
      marginLeft: 8,
      letterSpacing: 1,
  }
});

export default OrderHistoryScreen;