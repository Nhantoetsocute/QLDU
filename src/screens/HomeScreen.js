import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  FlatList,
  Animated,
  StatusBar,
  ImageBackground,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme/ThemeContext';
import { useUserProfile } from '../context/UserProfileContext';
import { useCart } from '../context/CartContext';

const { width, height } = Dimensions.get('window');

// --- COMPONENT: HIỆU ỨNG BỤI ÁNH SAO (FLOATING SPARKLES) ---
const Sparkle = ({ delay, startX, startY, size }) => {
  const translateY = useRef(new Animated.Value(startY)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: startY - 150, // Bay từ dưới lên từ từ
          duration: 10000 + Math.random() * 5000,
          delay: delay,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 0.5 + Math.random() * 0.5,
            duration: 2000 + Math.random() * 2000,
            delay: delay,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 2000 + Math.random() * 2000,
            useNativeDriver: true,
          }),
        ]),
      ])
    ).start();
  }, [delay, startY]);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: startX,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#D4AF37',
        shadowColor: '#D4AF37',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 10,
        transform: [{ translateY }],
        opacity: opacity,
      }}
    />
  );
};

const AmbientSparkles = React.memo(() => {
  const sparkles = Array.from({ length: 20 }).map((_, i) => (
    <Sparkle
      key={i}
      delay={Math.random() * 5000}
      startX={Math.random() * width}
      startY={height + Math.random() * 200}
      size={1 + Math.random() * 3}
    />
  ));
  return <View style={StyleSheet.absoluteFillObject} pointerEvents="none">{sparkles}</View>;
});

// --- DỮ LIỆU MẪU (Mock Data - Phiên bản cao cấp) ---
const categories = [
  { id: '1', name: 'Đặc Quyền', icon: 'crown', type: 'material', offerCategory: 'privilege' },
  { id: '2', name: 'Giao Nhận', icon: 'bike', type: 'material', offerCategory: 'delivery' },
  { id: '3', name: 'Mang Đi', icon: 'cup-outline', type: 'material', offerCategory: 'takeaway' },
  { id: '4', name: 'Đổi quà', icon: 'seed-outline', type: 'material', offerCategory: 'redeem' },
];

const premiumProducts = [
  {
    id: 1,
    name: 'Nước ép rau má',
    price: 120000,
    image: require('../../assets/images/rauma.jpg'),
    description: 'Rau má tươi xay lạnh cùng chút đường phèn thanh nhẹ, giúp giải nhiệt và làm dịu cơ thể trong ngày nắng.',
  },
  {
    id: 2,
    name: 'Trà đào cam sả',
    price: 55000,
    image: require('../../assets/images/tra_cam_xa.jpg'),
    description: 'Sự kết hợp của trà đen ủ đậm, đào ngọt dịu, cam mọng nước và hương sả thơm mát, cân bằng chua ngọt.',
  },
  {
    id: 3,
    name: 'Trà Chanh',
    price: 35000,
    image: require('../../assets/images/TC.avif'),
    description: 'Vị trà thanh nhẹ hòa cùng chanh tươi và đá lạnh, mang cảm giác sảng khoái tức thì, dễ uống mọi thời điểm.',
  },
  {
    id: 4,
    name: 'Trà Xanh',
    price: 40000,
    image: require('../../assets/images/tra_xanh.jpg'),
    description: 'Trà xanh nguyên lá với hậu vị dịu và hương thơm tự nhiên, phù hợp cho người thích vị trà thuần khiết.',
  },
  {
    id: 5,
    name: 'Cà phê sữa đá',
    price: 29000,
    image: require('../../assets/images/CPSD.webp'),
    description: 'Cà phê pha phin truyền thống thơm lừng kết hợp cùng sữa đặc béo ngậy.',
  },
];

const heroBanners = [
  {
    id: 2,
    badge: 'SIGNATURE',
    title: 'Trà đào cam sả',
    subtitle: 'Sự kết hợp hoàn hảo giữa trà đen và trái cây tươi.',
    image: require('../../assets/images/tra_cam_xa.jpg'),
  },
  {
    id: 5,
    badge: 'BEST SELLER',
    title: 'Cà phê sữa đá',
    subtitle: 'Hương vị tuổi trẻ, đậm đà nhưng ngọt bùi.',
    image: require('../../assets/images/CPSD.webp'),
  },
  {
    id: 1,
    badge: 'NEW',
    title: 'Nước ép rau má',
    subtitle: 'Thanh mát cơ thể ngày hè nóng nực.',
    image: require('../../assets/images/rauma.jpg'),
  },
];

const HomeScreen = ({ navigation }) => {
  const { isDarkMode, colors } = useAppTheme();
  const { profile, logoutContext } = useUserProfile();
  const { cartItems, addToCart } = useCart();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Chào buổi sáng,';
    if (hour >= 12 && hour < 17) return 'Chào buổi chiều,';
    if (hour >= 17 && hour < 21) return 'Chào buổi tối,';
    return 'Khuya rồi nhé,';
  };

  const ui = {
    overlay: isDarkMode ? 'rgba(10, 10, 10, 0.78)' : 'rgba(255, 255, 255, 0.38)',
    glassHeaderBg: isDarkMode ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.58)',
    cardBg: isDarkMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(248, 250, 252, 0.92)',
    cardBorder: isDarkMode ? 'rgba(212, 175, 55, 0.14)' : 'rgba(184, 134, 11, 0.18)',
    textPrimary: isDarkMode ? '#FFFFFF' : '#1A1A1A',
    textSecondary: isDarkMode ? '#A9A9A9' : '#4B5563',
    heroMask: isDarkMode ? 'rgba(0,0,0,0.42)' : 'rgba(0,0,0,0.28)',
  };

  const openOffersByCategory = (category) => {
    navigation.navigate('MainTabs', {
      screen: 'Ưu Đãi',
      params: { category },
    });
  };

  // Render danh mục ngang
  const renderCategoryItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.categoryPill, { backgroundColor: ui.cardBg, borderColor: ui.cardBorder }]}
      onPress={() => openOffersByCategory(item.offerCategory)}
    >
      <MaterialCommunityIcons name={item.icon} size={20} color="#D4AF37" style={styles.categoryIcon} />
      <Text style={[styles.categoryText, { color: ui.textPrimary }]}>{item.name}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />

      {/* Background tối sang trọng */}
      <ImageBackground
        source={{ uri: 'https://images.unsplash.com/photo-1497935586351-b67a49e012bf?q=80&w=800&auto=format&fit=crop' }}
        style={styles.backgroundImage}
      >
        <View style={[styles.overlay, { backgroundColor: ui.overlay }]} />
        <AmbientSparkles />

        {/* --- HEADER KÍNH MỜ --- */}
        <SafeAreaView>
          <View style={[styles.glassHeader, { backgroundColor: ui.glassHeaderBg, borderBottomColor: ui.cardBorder }]}>
            {/* Bọc khu vực Profile bằng TouchableOpacity để bắt sự kiện đăng xuất */}
            <TouchableOpacity
              style={styles.userInfo}
              onPress={() => {
                Alert.alert(
                  'Đăng xuất',
                  'Bạn có chắc chắn muốn đăng xuất?',
                  [
                    { text: 'Hủy', style: 'cancel' },
                    {
                      text: 'Đăng xuất',
                      style: 'destructive',
                      onPress: async () => {
                        await logoutContext();
                        navigation.replace('Login');
                      },
                    },
                  ]
                );
              }}
              activeOpacity={0.7}
            >
              {profile?.avatar ? (
                <Image
                  source={{ uri: profile.avatar }}
                  style={styles.avatar}
                />
              ) : (
                <View style={[styles.avatar, { justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(212, 175, 55, 0.2)' }]}>
                  <Ionicons name="person" size={24} color="#D4AF37" />
                </View>
              )}
              <View>
                <Text style={[styles.greeting, { color: ui.textSecondary }]}>{getGreeting()}</Text>
                <View style={styles.nameRow}>
                  <Text style={[styles.userName, { color: ui.textPrimary }]} numberOfLines={1}>
                    {profile?.name || 'Khách'}
                  </Text>
                  {/* Thêm một icon logout nhỏ màu gold để gợi ý người dùng */}
                  <MaterialCommunityIcons name="logout-variant" size={14} color="#D4AF37" style={{ marginLeft: 5 }} />
                </View>
                <Text style={[styles.logoutHint, { color: ui.textSecondary }]}>Chạm để đăng xuất</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.cartButton, { borderColor: ui.cardBorder }]}
              onPress={() => {
                const parentNav = navigation.getParent();
                if (parentNav) {
                  parentNav.navigate('Cart');
                  return;
                }
                navigation.navigate('Cart');
              }}
            >
              <Feather name="shopping-bag" size={24} color="#D4AF37" />
              {cartItems.length > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{cartItems.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

          {/* HERO SECTION: BANNER TRƯỢT */}
          <View style={styles.heroSection}>
            <FlatList
              data={heroBanners}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.id.toString()}
              snapToInterval={width - 20}
              decelerationRate="fast"
              contentContainerStyle={{ paddingLeft: 20, paddingRight: 0 }}
              renderItem={({ item }) => (
                <View style={{ width: width - 40, marginRight: 20 }}>
                  <ImageBackground
                    source={item.image}
                    style={styles.heroImageCard}
                    imageStyle={{ borderRadius: 24 }}
                  >
                    <View style={[styles.heroOverlay, { backgroundColor: ui.heroMask }]}>
                      <View style={styles.badgePremium}>
                        <Text style={styles.badgePremiumText}>{item.badge}</Text>
                      </View>
                      <View style={styles.heroTextContainer}>
                        <Text style={[styles.heroTitle, { color: '#FFFFFF' }]}>{item.title}</Text>
                        <Text style={[styles.heroSubtitle, { color: '#F1F5F9' }]}>{item.subtitle}</Text>
                        <TouchableOpacity
                          style={styles.heroButton}
                          onPress={() => {
                            const product = premiumProducts.find(p => p.id === item.id);
                            if (product) {
                              navigation.navigate('ProductDetail', { item: product });
                            }
                          }}
                        >
                          <Text style={styles.heroButtonText}>THỬ NGAY</Text>
                          <Ionicons name="arrow-forward" size={16} color="#1A1A1A" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </ImageBackground>
                </View>
              )}
            />
          </View>

          {/* DANH MỤC (Viên thuốc cẩm thạch) */}
          <View style={styles.categoriesSection}>
            <FlatList
              data={categories}
              renderItem={renderCategoryItem}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20 }}
            />
          </View>

          {/* BỘ SƯU TẬP THƯỢNG HẠNG (Premium Collection) */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.accent }]}>Bộ Sưu Tập Thượng Hạng</Text>
            <TouchableOpacity onPress={() => navigation.navigate('AllProducts')}>
              <Text style={[styles.seeMoreText, { color: ui.textSecondary }]}>Tất cả</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.productGrid}>
            {premiumProducts.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.premiumCard, { backgroundColor: ui.cardBg, borderColor: ui.cardBorder }]}
                onPress={() => navigation.navigate('ProductDetail', { item: item })}
              >
                <Image source={item.image} style={styles.premiumImage} />
                <View style={styles.premiumInfo}>
                  <Text style={[styles.premiumName, { color: ui.textPrimary }]} numberOfLines={2}>{item.name}</Text>
                  <View style={styles.premiumBottomRow}>
                    <Text style={styles.premiumPrice}>
                      {typeof item.price === 'number' ? `${item.price.toLocaleString('vi-VN')} đ` : item.price}
                    </Text>
                    <TouchableOpacity
                      style={styles.goldAddButton}
                      onPress={() => {
                        const numericPrice = typeof item.price === 'number' ? item.price :
                          Number(String(item.price || '').replace(/đ/gi, '').replace(/\./g, '').replace(/,/g, '').trim()) || 0;
                        addToCart({
                          id: item.id,
                          name: item.name,
                          price: numericPrice,
                          image: item.image,
                          quantity: 1
                        });
                        const msg = `Đã thêm ${item.name} vào giỏ hàng`;
                        if (Platform.OS === 'web') window.alert(msg);
                        else Alert.alert('Thành công', msg);
                      }}
                    >
                      <Ionicons name="add" size={18} color="#1A1A1A" />
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>

        </ScrollView>
      </ImageBackground>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  backgroundImage: {
    flex: 1,
    resizeMode: 'cover',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 10, 10, 0.85)', // Tối sâu để làm nền
  },
  scrollContent: {
    paddingBottom: 100, // Chừa chỗ cho thanh Bottom Tab Navigation
  },
  // --- Header Kính Mờ ---
  glassHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 14,
    marginTop: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.18)',
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#D4AF37',
  },
  greeting: {
    fontSize: 13,
    color: '#A9A9A9',
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoutHint: {
    fontSize: 11,
    marginTop: 2,
  },
  cartButton: {
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  // --- Hero Section ---
  heroSection: {
    marginTop: 25,
    marginBottom: 25,
  },
  heroImageCard: {
    width: '100%',
    height: 220,
    borderRadius: 24,
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 10,
  },
  heroOverlay: {
    flex: 1,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.4)',
    padding: 20,
    justifyContent: 'space-between',
  },
  badgePremium: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(212, 175, 55, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgePremiumText: {
    color: '#1A1A1A',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  heroTextContainer: {
    gap: 8,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFF',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  heroSubtitle: {
    fontSize: 14,
    color: '#E0E0E0',
    marginBottom: 10,
  },
  heroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D4AF37',
    alignSelf: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
  },
  heroButtonText: {
    color: '#1A1A1A',
    fontWeight: 'bold',
    fontSize: 12,
    letterSpacing: 1,
  },
  // --- Danh mục (Categories) ---
  categoriesSection: {
    marginBottom: 30,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 30,
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  categoryIcon: {
    marginRight: 8,
  },
  categoryText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  // --- Section Header ---
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#D4AF37',
    letterSpacing: 0.5,
  },
  seeMoreText: {
    fontSize: 14,
    color: '#A9A9A9',
    textDecorationLine: 'underline',
  },
  // --- Lưới sản phẩm (Grid) ---
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  premiumCard: {
    width: (width - 55) / 2, // 2 cột, padding 2 bên 20, khoảng cách giữa 15
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.15)',
    overflow: 'hidden',
  },
  premiumImage: {
    width: '100%',
    height: 150,
    resizeMode: 'cover',
  },
  premiumInfo: {
    padding: 12,
  },
  premiumName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 10,
    lineHeight: 20,
  },
  premiumBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  premiumPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#D4AF37',
  },
  goldAddButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#D4AF37',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default HomeScreen;