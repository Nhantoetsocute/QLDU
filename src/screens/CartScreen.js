import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme/ThemeContext';
import { useCart } from '../context/CartContext';

const initialCartData = [];

const formatPrice = (price) => `${price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')} đ`;

const CartScreen = ({ navigation, route }) => {
  const { isDarkMode, colors } = useAppTheme();
  const accent = colors.accent || '#E57905';

  const ui = {
    page: colors.background,
    surface: isDarkMode ? '#111111' : '#FFFFFF',
    card: isDarkMode ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
    border: isDarkMode ? 'rgba(255,255,255,0.14)' : '#E5E7EB',
    text: isDarkMode ? '#FFFFFF' : '#111111',
    subText: isDarkMode ? '#B3B3B3' : '#666666',
    imageBg: isDarkMode ? 'rgba(255,255,255,0.08)' : '#F5F5F5',
  };

  const { cartItems, updateQuantity, removeItem } = useCart();
  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => {
    // Tự động chọn các item mới được thêm vào
    const unselectedNewItemIds = cartItems.filter(item => !selectedIds.includes(item.id)).map(item => item.id);
    if (unselectedNewItemIds.length > 0) {
      setSelectedIds(prev => [...prev, ...unselectedNewItemIds]);
    }
  }, [cartItems.length]);

  const allSelected = cartItems.length > 0 && selectedIds.length === cartItems.length;

  const total = useMemo(() => {
    return cartItems.reduce((sum, item) => {
      if (!selectedIds.includes(item.id)) return sum;
      return sum + item.price * item.quantity;
    }, 0);
  }, [cartItems, selectedIds]);

  const toggleSelection = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(cartItems.map((item) => item.id));
  };

  const handleRemoveItem = (id) => {
    removeItem(id);
    setSelectedIds((prev) => prev.filter((itemId) => itemId !== id));
  };

  const renderCartItem = ({ item }) => {
    const isSelected = selectedIds.includes(item.id);

    return (
      <View style={[styles.cartItemCard, { backgroundColor: ui.card, borderColor: ui.border }]}>
        <TouchableOpacity
          style={[
            styles.checkbox,
            { borderColor: ui.border },
            isSelected && { backgroundColor: accent, borderColor: accent },
          ]}
          onPress={() => toggleSelection(item.id)}
        >
          {isSelected ? <Ionicons name="checkmark" size={14} color="#FFF" /> : null}
        </TouchableOpacity>

        <View style={[styles.imageContainer, { backgroundColor: ui.imageBg }]}>
          <Image source={typeof item.image === 'string' ? { uri: item.image } : item.image} style={styles.productImage} />
        </View>

        <View style={styles.productInfo}>
          <Text style={[styles.productName, { color: ui.text }]} numberOfLines={2}>
            {item.name}
          </Text>
          <Text style={[styles.productPrice, { color: accent }]}>{formatPrice(item.price)}</Text>

          <View style={styles.quantityControl}>
            <TouchableOpacity onPress={() => updateQuantity(item.id, -1)} style={styles.qtyBtn}>
              <Feather name="minus" size={16} color={ui.subText} />
            </TouchableOpacity>
            <Text style={[styles.qtyText, { color: ui.text }]}>{item.quantity}</Text>
            <TouchableOpacity onPress={() => updateQuantity(item.id, 1)} style={styles.qtyBtn}>
              <Feather name="plus" size={16} color={accent} />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity onPress={() => handleRemoveItem(item.id)} style={styles.deleteBtn}>
          <Feather name="trash-2" size={22} color="#E74C3C" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: ui.page }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={ui.surface} />

      <View style={[styles.header, { backgroundColor: ui.surface }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={ui.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: ui.text }]}>Giỏ hàng của bạn</Text>
        <View style={styles.headerSpacer} />
      </View>

      <TouchableOpacity style={[styles.selectAllBtn, { backgroundColor: accent }]} onPress={toggleSelectAll}>
        <Text style={styles.selectAllText}>{allSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}</Text>
      </TouchableOpacity>

      <FlatList
        data={cartItems}
        keyExtractor={(item) => item.id}
        renderItem={renderCartItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: ui.subText }]}>Giỏ hàng của bạn đang trống.</Text>
        }
      />

      <View style={[styles.bottomBar, { backgroundColor: ui.surface, borderTopColor: ui.border }]}>
        <Text style={[styles.totalLabel, { color: ui.text }]}>Tổng tiền: {formatPrice(total)}</Text>
        <TouchableOpacity style={[styles.checkoutBtn, { backgroundColor: accent }]}>
          <Text style={styles.checkoutText}>Thanh toán</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 14,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  headerSpacer: {
    width: 24,
  },
  selectAllBtn: {
    marginHorizontal: 15,
    marginTop: 8,
    marginBottom: 5,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  selectAllText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom: 24,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
  },
  cartItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  imageContainer: {
    width: 65,
    height: 65,
    borderRadius: 8,
    marginRight: 14,
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  productInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  productName: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '600',
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qtyBtn: {
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  qtyText: {
    fontSize: 16,
    fontWeight: '700',
    marginHorizontal: 10,
    minWidth: 14,
    textAlign: 'center',
  },
  deleteBtn: {
    padding: 8,
    marginLeft: 8,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderTopWidth: 1,
  },
  totalLabel: {
    fontSize: 17,
    fontWeight: '700',
  },
  checkoutBtn: {
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 8,
  },
  checkoutText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default CartScreen;