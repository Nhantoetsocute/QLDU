import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Dimensions,
  Animated,
  StatusBar,
  TextInput,
  ImageBackground,
} from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme/ThemeContext';

const { width } = Dimensions.get('window');

// --- DỮ LIỆU DANH MỤC ĐỒ UỐNG CỦA BẠN ---
const drinkCategories = [
  { id: 'all', name: 'Tất cả', icon: 'view-grid' },
  { id: 'basic', name: 'Nước Cơ Bản', icon: 'water' },
  { id: 'soda', name: 'Giải Khát', icon: 'cup' },
  { id: 'fruit', name: 'Trái Cây', icon: 'fruit-cherries' },
  { id: 'milk', name: 'Đồ Uống Sữa', icon: 'cow' },
  { id: 'tea', name: 'Trà - Cà Phê', icon: 'coffee' },
  { id: 'nutri', name: 'Dinh Dưỡng', icon: 'flash' },
];

const allDrinks = [
  { id: '1', name: 'Nước Ion Kiềm Cao Cấp', price: '25.000 đ', tag: 'Pure', image: require('../../assets/images/ion.png'), category: 'basic', description: 'Nước ion kiềm tinh lọc với vị mềm nhẹ, hỗ trợ bù khoáng và làm dịu cơ thể sau vận động.' },
  { id: '2', name: 'Soda Mix Dâu Rừng', price: '45.000 đ', tag: 'Fresh', image: require('../../assets/images/soda.jpg'), category: 'soda', description: 'Soda mát lạnh kết hợp siro dâu rừng thơm ngọt, tạo cảm giác sủi tê vui miệng và trẻ trung.' },
  { id: '3', name: 'Sữa Hạnh Nhân Organic', price: '65.000 đ', tag: 'Healthy', image: require('../../assets/images/sua.jpg'), category: 'milk', description: 'Sữa hạnh nhân nguyên chất, béo nhẹ tự nhiên, không ngấy, phù hợp cho lối sống lành mạnh.' },
  { id: '4', name: 'Nước Ép Cam Tươi Nguyên Chất', price: '55.000 đ', tag: 'Vitamin', image: require('../../assets/images/cam.png'), category: 'fruit', description: 'Cam tươi ép tại quầy giữ trọn vị chua ngọt tự nhiên và hương thơm mọng nước giàu vitamin C.' },
  { id: '5', name: 'Protein Shake Socola', price: '85.000 đ', tag: 'Energy', image: require('../../assets/images/protein.jpeg'), category: 'nutri', description: 'Protein shake vị socola đậm đà, tăng năng lượng nhanh, thích hợp trước hoặc sau khi tập luyện.' },
  { id: '6', name: 'Cold Brew Thượng Hạng', price: '75.000 đ', tag: 'Signature', image: require('../../assets/images/cold_brew.jpg'), category: 'tea', description: 'Cold brew ủ lạnh nhiều giờ cho vị cà phê êm, ít chua gắt, hậu vị kéo dài và thơm sâu.' },
];

const AllProductsScreen = ({ navigation }) => {
  const { isDarkMode, colors } = useAppTheme();
  const ui = {
    headerBg: isDarkMode ? 'rgba(20,20,20,0.7)' : 'rgba(255,255,255,0.78)',
    cardBg: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(248,250,252,0.94)',
    cardBorder: isDarkMode ? 'rgba(212,175,55,0.18)' : 'rgba(184,134,11,0.25)',
    textPrimary: isDarkMode ? '#FFFFFF' : '#111827',
    textSecondary: isDarkMode ? '#AAA' : '#4B5563',
    inputBg: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.92)',
  };

  const [selectedCat, setSelectedCat] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
  }, [selectedCat]);

  const filteredDrinks = allDrinks
    .filter((d) => selectedCat === 'all' || d.category === selectedCat)
    .filter((d) => d.name.toLowerCase().includes(searchText.trim().toLowerCase()));

  const renderDrinkCard = ({ item }) => (
    
    <TouchableOpacity
      style={[styles.card, { backgroundColor: ui.cardBg, borderColor: ui.cardBorder }]}
      activeOpacity={0.9}
      onPress={() => navigation.navigate('ProductDetail', { item: item })}
    >
      <Image source={typeof item.image === 'string' ? { uri: item.image } : item.image} style={styles.cardImage} />
      
      {/* Tag nổi bật */}
      <View style={styles.tagContainer}>
        <Text style={styles.tagText}>{item.tag}</Text>
      </View>

      <View style={styles.cardInfo}>
        <Text style={[styles.drinkName, { color: ui.textPrimary }]} numberOfLines={2}>{item.name}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.drinkPrice}>{item.price}</Text>
          <TouchableOpacity style={styles.addButton}>
            <Ionicons name="add" size={20} color="#1A1A1A" />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }] }>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} translucent />
      
      <ImageBackground
        source={{ uri: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?q=80&w=800' }}
        style={styles.bg}
      >
        <View style={[styles.overlay, { backgroundColor: colors.overlay }]} />

        {/* HEADER GỌN GÀNG */}
        <SafeAreaView style={[styles.safeHeader, { backgroundColor: ui.headerBg, borderBottomColor: ui.cardBorder }]}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconCircle}>
              <Ionicons name="chevron-back" size={24} color="#D4AF37" />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.accent }]}>True Juice</Text>
            <TouchableOpacity
              style={styles.iconCircle}
              onPress={() => setShowSearch((prev) => !prev)}
            >
              <Feather name="search" size={20} color="#D4AF37" />
            </TouchableOpacity>
          </View>

          {showSearch && (
            <View style={[styles.searchBox, { backgroundColor: ui.inputBg, borderColor: ui.cardBorder }] }>
              <Feather name="search" size={16} color="#D4AF37" />
              <TextInput
                value={searchText}
                onChangeText={setSearchText}
                placeholder="Tìm đồ uống..."
                placeholderTextColor={ui.textSecondary}
                style={[styles.searchInput, { color: ui.textPrimary }]}
              />
              {searchText.length > 0 && (
                <TouchableOpacity onPress={() => setSearchText('')}>
                  <Ionicons name="close-circle" size={18} color="#D4AF37" />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* CATEGORY LIST DẠNG ICON GOLD */}
          <FlatList
            data={drinkCategories}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.catList}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity 
              style={[styles.catItem, { backgroundColor: ui.cardBg, borderColor: ui.cardBorder }, selectedCat === item.id && styles.catItemActive]}
                onPress={() => {
                    fadeAnim.setValue(0);
                    setSelectedCat(item.id);
                }}
              >
                <MaterialCommunityIcons 
                    name={item.icon} 
                    size={22} 
                    color={selectedCat === item.id ? "#1A1A1A" : "#D4AF37"} 
                />
                <Text style={[styles.catText, { color: ui.textPrimary }, selectedCat === item.id && styles.catTextActive]}>
                    {item.name}
                </Text>
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>

        {/* LIST ĐỒ UỐNG */}
        <Animated.FlatList
          data={filteredDrinks}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.listPadding}
          style={{ opacity: fadeAnim }}
          renderItem={renderDrinkCard}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: ui.textSecondary }]}>Không tìm thấy sản phẩm phù hợp</Text>
          }
        />
      </ImageBackground>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  bg: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.85)' },
  safeHeader: { backgroundColor: 'rgba(20,20,20,0.7)', borderBottomWidth: 1, borderBottomColor: 'rgba(212,175,55,0.2)' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 10 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#D4AF37', letterSpacing: 1 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(212,175,55,0.1)', justifyContent: 'center', alignItems: 'center' },
  searchBox: {
    marginHorizontal: 20,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.25)',
    borderRadius: 14,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: '#FFF',
    paddingVertical: 10,
    fontSize: 14,
  },
  
  catList: { paddingLeft: 20, paddingBottom: 15 },
  catItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'rgba(255,255,255,0.05)', 
    paddingHorizontal: 15, 
    paddingVertical: 10, 
    borderRadius: 20, 
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)'
  },
  catItemActive: { backgroundColor: '#D4AF37' },
  catText: { color: '#FFF', marginLeft: 8, fontSize: 13, fontWeight: '600' },
  catTextActive: { color: '#1A1A1A' },

  listPadding: { padding: 15, paddingBottom: 100 },
  columnWrapper: { justifyContent: 'space-between' },
  card: { 
    width: (width - 45) / 2, 
    backgroundColor: 'rgba(255,255,255,0.04)', 
    borderRadius: 20, 
    marginBottom: 20, 
    borderWidth: 1, 
    borderColor: 'rgba(212,175,55,0.15)',
    overflow: 'hidden'
  },
  cardImage: { width: '100%', height: 160 },
  tagContainer: { position: 'absolute', top: 10, left: 10, backgroundColor: 'rgba(212,175,55,0.9)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 },
  tagText: { fontSize: 10, fontWeight: '800', color: '#1A1A1A' },
  cardInfo: { padding: 12 },
  drinkName: { color: '#FFF', fontSize: 14, fontWeight: 'bold', height: 40 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  drinkPrice: { color: '#D4AF37', fontWeight: 'bold', fontSize: 15 },
  addButton: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#D4AF37', justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#AAA', textAlign: 'center', marginTop: 30, fontSize: 14 },
});

export default AllProductsScreen;