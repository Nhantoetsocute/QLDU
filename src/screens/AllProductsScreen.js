import BackgroundImage from '../components/BackgroundImage';
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
  TouchableWithoutFeedback,
  Keyboard,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme/ThemeContext';
import { useCart } from '../context/CartContext';
import { fetchCatalog } from '../services/catalog';

const { width } = Dimensions.get('window');

const categoryIcon = (name) => {
  const normalized = String(name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (normalized.includes('tra')) return 'leaf';
  if (normalized.includes('phe')) return 'coffee';
  if (normalized.includes('ep')) return 'fruit-cherries';
  if (normalized.includes('sua')) return 'cow';
  if (normalized.includes('dinh')) return 'flash';
  return 'cup';
};

const AllProductsScreen = ({ navigation }) => {
  const { isDarkMode, colors } = useAppTheme();
  const { addToCart } = useCart();
  const [allDrinks, setAllDrinks] = useState([]);
  const [drinkCategories, setDrinkCategories] = useState([{ id: 'all', name: 'Tất cả', icon: 'view-grid' }]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');

  const loadProducts = async (signal) => {
    setCatalogLoading(true);
    setCatalogError('');
    try {
      const { products, categories } = await fetchCatalog({ signal });
      if (signal?.aborted) return;
      setAllDrinks(products);
      setDrinkCategories([
        { id: 'all', name: 'Tất cả', icon: 'view-grid' },
        ...categories.map((category) => ({ id: String(category.id), name: category.name, icon: categoryIcon(category.name) })),
      ]);
    } catch (error) {
      if (!signal?.aborted) setCatalogError(error.message || 'Không thể tải sản phẩm.');
    } finally {
      if (!signal?.aborted) setCatalogLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    loadProducts(controller.signal);
    return () => controller.abort();
  }, []);

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
  const [toastMessage, setToastMessage] = useState('');
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastTimerRef = useRef(null);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
  }, [selectedCat]);

  useEffect(() => () => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
  }, []);

  const filteredDrinks = allDrinks
    .filter((d) => selectedCat === 'all' || String(d.categoryId) === selectedCat)
    .filter((d) => d.name.toLowerCase().includes(searchText.trim().toLowerCase()));

  const addItemToCart = (item) => {
    const numericPrice = typeof item.price === 'number' ? item.price :
      Number(String(item.price || '').replace(/đ/gi, '').replace(/\./g, '').replace(/,/g, '').trim()) || 0;

    addToCart({
      id: item.id,
      productId: item.productId,
      name: item.name,
      price: numericPrice,
      image: item.image,
      quantity: 1
    });

    const msg = `Đã thêm ${item.name} vào giỏ hàng`;
    setToastMessage(msg);
    Animated.timing(toastAnim, {
      toValue: 1,
      duration: 160,
      useNativeDriver: true,
    }).start();

    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => {
      Animated.timing(toastAnim, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }).start(() => setToastMessage(''));
    }, 1700);
  };

  const handleConfirmAddToCart = (item) => {
    const confirmMessage = `Bạn có muốn thêm ${item.name} vào giỏ hàng không?`;

    if (Platform.OS === 'web') {
      const ok = window.confirm(confirmMessage);
      if (ok) addItemToCart(item);
      return;
    }

    Alert.alert(
      'Thêm vào giỏ hàng',
      confirmMessage,
      [
        { text: 'Không', style: 'cancel' },
        { text: 'Đồng ý', onPress: () => addItemToCart(item) },
      ],
      { cancelable: true }
    );
  };

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
          <Text style={styles.drinkPrice}>
            {typeof item.price === 'number' ? `${item.price.toLocaleString('vi-VN')} đ` : item.price}
          </Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => handleConfirmAddToCart(item)}
          >
            <Ionicons name="add" size={20} color="#1A1A1A" />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={[styles.container, { backgroundColor: colors.background }]}> 
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} translucent />

      <BackgroundImage
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
            <View style={[styles.searchBox, { backgroundColor: ui.inputBg, borderColor: ui.cardBorder }]}>
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
            catalogLoading ? <ActivityIndicator style={{ marginTop: 30 }} color={colors.accent} accessibilityLabel="Đang tải sản phẩm" /> : (
              <View style={{ padding: 20 }}>
                <Text style={[styles.emptyText, { color: ui.textSecondary }]}>{catalogError || 'Không tìm thấy sản phẩm phù hợp'}</Text>
                {catalogError ? <TouchableOpacity onPress={() => loadProducts()} accessibilityRole="button" style={{ alignItems: 'center', padding: 12 }}>
                  <Text style={{ color: colors.accent, fontWeight: '700' }}>Thử lại</Text>
                </TouchableOpacity> : null}
              </View>
            )
          }
        />
      </BackgroundImage>

      {toastMessage ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.toast,
            {
              opacity: toastAnim,
              transform: [
                {
                  translateY: toastAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      ) : null}
      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  bg: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.85)' },
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
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(20,20,20,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  toastText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});

export default AllProductsScreen;