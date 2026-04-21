import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StatusBar,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useAppTheme } from '../theme/ThemeContext';
import { useCart } from '../context/CartContext';
import { useUserProfile } from '../context/UserProfileContext';
import { apiUrl } from '../config/api';

const formatPrice = (price) => `${price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')} đ`;

const paymentMethods = [
  { id: 1, key: 'cod', name: 'Thanh toán khi nhận hàng', icon: 'cash-outline', desc: 'Trả tiền mặt cho shipper' },
  { id: 2, key: 'vnpay', name: 'VNPAY', icon: 'card-outline', desc: 'Ví điện tử, QR, thẻ ngân hàng' },
];

const CheckoutScreen = ({ navigation }) => {
  const { isDarkMode, colors } = useAppTheme();
  const { cartItems, clearCart } = useCart();
  const { profile, token } = useUserProfile();

  const [receiverName, setReceiverName] = useState(profile?.name || '');
  const [receiverPhone, setReceiverPhone] = useState(profile?.phone || '');
  const [deliveryAddress, setDeliveryAddress] = useState(profile?.address || '');
  const [note, setNote] = useState('');
  const [selectedPayment, setSelectedPayment] = useState(1);
  const [voucherCode, setVoucherCode] = useState('');
  const [discount, setDiscount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [addressFocused, setAddressFocused] = useState(false);

  const ui = {
    bg: colors.background,
    card: isDarkMode ? 'rgba(255,255,255,0.05)' : '#FFFFFF',
    cardBorder: isDarkMode ? 'rgba(212,175,55,0.15)' : 'rgba(0,0,0,0.06)',
    text: colors.text,
    subText: colors.subText,
    accent: colors.accent,
    inputBg: isDarkMode ? 'rgba(255,255,255,0.06)' : '#F5F5F5',
    divider: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
  };

  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shippingFee = subtotal >= 200000 ? 0 : 15000;
  const total = Math.max(0, subtotal + shippingFee - discount);

  const handleApplyVoucher = async () => {
    if (!voucherCode.trim()) return;
    try {
      const res = await fetch(apiUrl('/api/vouchers'));
      const vouchers = await res.json();
      const found = vouchers.find(v => v.code?.toLowerCase() === voucherCode.trim().toLowerCase());
      if (found) {
        const discountAmt = found.discount || Math.round(subtotal * (found.percentage || 0) / 100);
        if (found.minOrder && subtotal < found.minOrder) {
          Alert.alert('Không đủ điều kiện', `Đơn hàng tối thiểu ${formatPrice(found.minOrder)} để dùng mã này.`);
          return;
        }
        setDiscount(discountAmt);
        Alert.alert('Thành công!', `Đã áp dụng giảm ${formatPrice(discountAmt)}`);
      } else {
        Alert.alert('Mã không hợp lệ', 'Vui lòng kiểm tra lại mã voucher.');
      }
    } catch (e) {
      Alert.alert('Lỗi', 'Không thể kiểm tra voucher. Hãy thử lại sau.');
    }
  };

  const handleOrder = async () => {
    if (!receiverName.trim() || !receiverPhone.trim() || !deliveryAddress.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập đầy đủ Tên, SĐT và Địa chỉ.');
      return;
    }
    if (cartItems.length === 0) {
      Alert.alert('Giỏ hàng trống', 'Vui lòng thêm sản phẩm trước khi đặt hàng.');
      return;
    }

    const paymentMethod = paymentMethods.find(p => p.id === selectedPayment);

    // For VNPAY, navigate to VNPay screen — backend se tao don hang
    if (selectedPayment === 2) {
      navigation.navigate('VNPayScreen', {
        amount: total,
        orderInfo: `Thanh toan don hang`,
        receiverName: receiverName.trim(),
        receiverPhone: receiverPhone.trim(),
        deliveryAddress: deliveryAddress.trim(),
        note: note.trim(),
        voucherId: null,
        cartItems: cartItems.map(item => ({
          productId: item.productId || item.id,
          id: item.id,
          quantity: item.quantity,
          name: item.name,
          price: item.price,
        })),
      });
      return;
    }

    // For COD, create order via API
    setIsLoading(true);
    try {
      const res = await fetch(apiUrl('/api/orders'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          paymentMethodId: 1,
          receiverName: receiverName.trim(),
          receiverPhone: receiverPhone.trim(),
          deliveryAddress: deliveryAddress.trim(),
          note: note.trim(),
          voucherId: null,
          items: cartItems.map(item => ({
            productId: item.productId || item.id,
            id: item.id,
            quantity: item.quantity,
            name: item.name,
            price: item.price,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Không thể tạo đơn hàng');
      }

      clearCart();

      Alert.alert(
        '🎉 Đặt hàng thành công!',
        `Mã đơn: ${data.orderCode}\nTổng thanh toán: ${formatPrice(data.totalAmount)}\n\nShipper sẽ liên hệ bạn sớm nhất!`,
        [
          {
            text: 'Xem đơn hàng',
            onPress: () => {
              navigation.navigate('MainTabs', {
                screen: 'Đặt Hàng',
                params: { refresh: Date.now() },
              });
            },
          },
        ]
      );
    } catch (error) {
      console.error(error);
      Alert.alert('Lỗi', error.message || 'Không thể tạo đơn hàng. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
      <SafeAreaView style={[styles.container, { backgroundColor: ui.bg }]}> 
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={ui.accent} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: ui.text }]}>Xác nhận đơn hàng</Text>
        <View style={{ width: 28 }} />
      </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: 110, flexGrow: 1 }]}
            keyboardShouldPersistTaps="always"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            nestedScrollEnabled
          >
          {/* ORDER SUMMARY */}
          <Text style={[styles.sectionLabel, { color: ui.subText }]}>ĐƠN HÀNG ({cartItems.length} MÓN)</Text>
          <View style={[styles.card, { backgroundColor: ui.card, borderColor: ui.cardBorder }]}>
            {cartItems.map((item, index) => (
              <View key={item.id}>
                <View style={styles.orderItem}>
                  <Image
                    source={typeof item.image === 'string' ? { uri: item.image } : item.image}
                    style={styles.orderItemImage}
                  />
                  <View style={styles.orderItemInfo}>
                    <Text style={[styles.orderItemName, { color: ui.text }]} numberOfLines={1}>{item.name}</Text>
                    <Text style={[styles.orderItemQty, { color: ui.subText }]}>x{item.quantity}</Text>
                  </View>
                  <Text style={[styles.orderItemPrice, { color: ui.accent }]}>
                    {formatPrice(item.price * item.quantity)}
                  </Text>
                </View>
                {index < cartItems.length - 1 && (
                  <View style={[styles.divider, { backgroundColor: ui.divider }]} />
                )}
              </View>
            ))}
          </View>

          {/* DELIVERY INFO */}
          <Text style={[styles.sectionLabel, { color: ui.subText }]}>THÔNG TIN NHẬN HÀNG</Text>
          <View style={[styles.card, { backgroundColor: ui.card, borderColor: ui.cardBorder }]}>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: ui.text }]}>Họ và tên</Text>
              <TextInput
                style={[styles.input, { backgroundColor: ui.inputBg, color: ui.text }]}
                placeholder="Nhập tên người nhận"
                placeholderTextColor={ui.subText}
                value={receiverName}
                onChangeText={setReceiverName}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: ui.text }]}>Số điện thoại</Text>
              <TextInput
                style={[styles.input, { backgroundColor: ui.inputBg, color: ui.text }]}
                placeholder="Nhập số điện thoại"
                placeholderTextColor={ui.subText}
                keyboardType="phone-pad"
                value={receiverPhone}
                onChangeText={setReceiverPhone}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: addressFocused ? ui.accent : ui.text }]}>Địa chỉ giao hàng</Text>
              <Text style={[styles.inputHint, { color: ui.subText }]}>Nhập đầy đủ số nhà, tên đường, phường/xã, quận/huyện, tỉnh/thành phố</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: addressFocused ? (isDarkMode ? 'rgba(212,175,55,0.08)' : 'rgba(212,175,55,0.08)') : ui.inputBg,
                    color: ui.text,
                    borderColor: addressFocused ? ui.accent : 'transparent',
                  },
                ]}
                placeholder="Ví dụ: 12 Thái Hà, Trung Liệt, Đống Đa, Hà Nội"
                placeholderTextColor={ui.subText}
                value={deliveryAddress}
                onChangeText={setDeliveryAddress}
                onFocus={() => setAddressFocused(true)}
                onBlur={() => setAddressFocused(false)}
              />
            </View>
            <View style={[styles.inputGroup, { marginBottom: 0 }]}>
              <Text style={[styles.inputLabel, { color: ui.text }]}>Ghi chú</Text>
              <TextInput
                style={[styles.input, { backgroundColor: ui.inputBg, color: ui.text }]}
                placeholder="VD: Ít đá, ít ngọt..."
                placeholderTextColor={ui.subText}
                value={note}
                onChangeText={setNote}
              />
            </View>
          </View>

          {/* PAYMENT METHOD */}
          <Text style={[styles.sectionLabel, { color: ui.subText }]}>PHƯƠNG THỨC THANH TOÁN</Text>
          <View style={[styles.card, { backgroundColor: ui.card, borderColor: ui.cardBorder }]}>
            {paymentMethods.map((method, index) => (
              <View key={method.id}>
                <TouchableOpacity
                  style={styles.paymentRow}
                  onPress={() => setSelectedPayment(method.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.paymentIconBox, { backgroundColor: selectedPayment === method.id ? 'rgba(212,175,55,0.12)' : 'rgba(128,128,128,0.08)' }]}>
                    <Ionicons name={method.icon} size={22} color={selectedPayment === method.id ? ui.accent : ui.subText} />
                  </View>
                  <View style={styles.paymentInfo}>
                    <Text style={[styles.paymentName, { color: selectedPayment === method.id ? ui.accent : ui.text }]}>
                      {method.name}
                    </Text>
                    <Text style={[styles.paymentDesc, { color: ui.subText }]}>{method.desc}</Text>
                  </View>
                  <View style={[styles.radioOuter, { borderColor: selectedPayment === method.id ? ui.accent : 'rgba(128,128,128,0.3)' }]}>
                    {selectedPayment === method.id && (
                      <View style={[styles.radioInner, { backgroundColor: ui.accent }]} />
                    )}
                  </View>
                </TouchableOpacity>
                {index < paymentMethods.length - 1 && (
                  <View style={[styles.divider, { backgroundColor: ui.divider }]} />
                )}
              </View>
            ))}
          </View>

          {/* VOUCHER */}
          <Text style={[styles.sectionLabel, { color: ui.subText }]}>MÃ GIẢM GIÁ</Text>
          <View style={[styles.card, { backgroundColor: ui.card, borderColor: ui.cardBorder }]}>
            <View style={styles.voucherRow}>
              <TextInput
                style={[styles.voucherInput, { backgroundColor: ui.inputBg, color: ui.text }]}
                placeholder="Nhập mã voucher"
                placeholderTextColor={ui.subText}
                autoCapitalize="characters"
                value={voucherCode}
                onChangeText={setVoucherCode}
              />
              <TouchableOpacity
                style={[styles.voucherBtn, { backgroundColor: ui.accent }]}
                onPress={handleApplyVoucher}
              >
                <Text style={styles.voucherBtnText}>Áp dụng</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* PRICE SUMMARY */}
          <Text style={[styles.sectionLabel, { color: ui.subText }]}>TỔNG CỘNG</Text>
          <View style={[styles.card, { backgroundColor: ui.card, borderColor: ui.cardBorder }]}>
            <View style={styles.priceRow}>
              <Text style={[styles.priceLabel, { color: ui.subText }]}>Tạm tính</Text>
              <Text style={[styles.priceValue, { color: ui.text }]}>{formatPrice(subtotal)}</Text>
            </View>
            <View style={styles.priceRow}>
              <Text style={[styles.priceLabel, { color: ui.subText }]}>Phí giao hàng</Text>
              <Text style={[styles.priceValue, { color: shippingFee === 0 ? '#2ECC71' : ui.text }]}>
                {shippingFee === 0 ? 'Miễn phí' : formatPrice(shippingFee)}
              </Text>
            </View>
            {discount > 0 && (
              <View style={styles.priceRow}>
                <Text style={[styles.priceLabel, { color: ui.subText }]}>Giảm giá</Text>
                <Text style={[styles.priceValue, { color: '#2ECC71' }]}>-{formatPrice(discount)}</Text>
              </View>
            )}
            <View style={[styles.totalDivider, { backgroundColor: ui.divider }]} />
            <View style={styles.priceRow}>
              <Text style={[styles.totalLabel, { color: ui.text }]}>Tổng thanh toán</Text>
              <Text style={[styles.totalValue, { color: ui.accent }]}>{formatPrice(total)}</Text>
            </View>
            {shippingFee > 0 && (
              <Text style={[styles.freeShipNote, { color: ui.subText }]}>
                💡 Đơn từ 200.000đ được miễn phí giao hàng
              </Text>
            )}
          </View>
          </ScrollView>

          {/* BOTTOM BAR */}
          <View style={[styles.bottomBar, { backgroundColor: isDarkMode ? '#111' : '#FFF', borderTopColor: ui.cardBorder }]}> 
          <View>
            <Text style={[styles.bottomTotal, { color: ui.text }]}>Tổng: {formatPrice(total)}</Text>
            <Text style={[styles.bottomItems, { color: ui.subText }]}>{cartItems.length} sản phẩm</Text>
          </View>
          <TouchableOpacity
            style={[styles.orderBtn, { backgroundColor: ui.accent }, isLoading && { opacity: 0.7 }]}
            onPress={handleOrder}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            <Text style={styles.orderBtnText}>
              {isLoading ? 'ĐANG XỬ LÝ...' : 'ĐẶT HÀNG'}
            </Text>
          </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
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
  headerTitle: { fontSize: 20, fontWeight: '800', letterSpacing: 0.3 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 30 },

  sectionLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 10,
    marginLeft: 5,
    marginTop: 5,
  },

  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
  },

  // Order items
  orderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  orderItemImage: {
    width: 48,
    height: 48,
    borderRadius: 10,
    marginRight: 14,
  },
  orderItemInfo: { flex: 1 },
  orderItemName: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  orderItemQty: { fontSize: 13 },
  orderItemPrice: { fontSize: 14, fontWeight: '700' },

  // Input
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  inputHint: { fontSize: 12, lineHeight: 18, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 14,
    fontSize: 14,
  },

  // Payment
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  paymentIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  paymentInfo: { flex: 1 },
  paymentName: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  paymentDesc: { fontSize: 12 },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: { width: 12, height: 12, borderRadius: 6 },

  // Voucher
  voucherRow: { flexDirection: 'row', alignItems: 'center' },
  voucherInput: {
    flex: 1,
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 14,
    fontSize: 14,
    marginRight: 10,
  },
  voucherBtn: {
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  voucherBtnText: { color: '#1A1A1A', fontSize: 14, fontWeight: '700' },

  // Price
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  priceLabel: { fontSize: 14 },
  priceValue: { fontSize: 14, fontWeight: '600' },
  totalDivider: { height: 1, marginVertical: 10 },
  totalLabel: { fontSize: 16, fontWeight: '800' },
  totalValue: { fontSize: 20, fontWeight: '800' },
  freeShipNote: { fontSize: 12, marginTop: 5, fontStyle: 'italic' },

  divider: { height: 1 },

  // Bottom
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
  },
  bottomTotal: { fontSize: 17, fontWeight: '800' },
  bottomItems: { fontSize: 13, marginTop: 2 },
  orderBtn: {
    borderRadius: 14,
    paddingHorizontal: 30,
    paddingVertical: 16,
  },
  orderBtnText: {
    color: '#1A1A1A',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
});

export default CheckoutScreen;
