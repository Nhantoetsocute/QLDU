import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
  Animated,
  StatusBar,
  ScrollView,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useAppTheme } from '../theme/ThemeContext';

const { width, height } = Dimensions.get('window');

const ProductDetailScreen = ({ route, navigation }) => {
  const { isDarkMode, colors } = useAppTheme();

  // Lấy dữ liệu sản phẩm được truyền sang từ các trang trước
  // Nếu không có, dùng dữ liệu mẫu (phòng trường hợp lỗi)
  const item = route.params?.item || {
    name: 'Trà Xanh Espresso Marble',
    price: '40.500 đ',
    image: 'https://images.unsplash.com/photo-1514432324607-a2c522b4ae12?q=80&w=800',
    description: 'Sự kết hợp hoàn hảo giữa vị chát nhẹ của trà xanh matcha Nhật Bản thượng hạng và lớp espresso đậm đà quyến rũ, thêm chút béo ngậy của sữa tươi. Một tuyệt tác đánh thức mọi giác quan.',
  };
  const imageSource = typeof item.image === 'string' ? { uri: item.image } : item.image;

  const parsePrice = (value) => {
    if (typeof value === 'number') return value;
    const numeric = String(value || '')
      .replace(/đ/gi, '')
      .replace(/\./g, '')
      .replace(/,/g, '')
      .trim();
    return Number(numeric) || 0;
  };

  const [quantity, setQuantity] = useState(1);
  const [checkoutMode, setCheckoutMode] = useState(null);
  const [voucherModalVisible, setVoucherModalVisible] = useState(false);
  const [selectedDiscountVoucher, setSelectedDiscountVoucher] = useState(null);
  const [selectedShippingVoucher, setSelectedShippingVoucher] = useState(null);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [hasPurchased, setHasPurchased] = useState(false);
  const [reviewText, setReviewText] = useState('');
  const [myRating, setMyRating] = useState(5);
  const [reviews, setReviews] = useState([
    { id: 'r1', name: 'Minh Anh', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=120', rating: 5, comment: 'Vị rất thơm, hậu ngọt nhẹ, uống cực cuốn. Uống buổi sáng rất tỉnh táo.' },
    { id: 'r2', name: 'Hoàng Nam', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=120', rating: 4, comment: 'Đóng gói đẹp, giao nhanh, chất lượng ổn định. Giá hơi cao một chút nhưng đáng thử.' },
    { id: 'r3', name: 'Thảo Vy', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=120', rating: 3, comment: 'Mùi thơm ổn, vị vừa phải. Với mình thì hơi ngọt nên cho 3 sao.' },
    { id: 'r4', name: 'Quốc Bảo', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=120', rating: 2, comment: 'Lần này đá nhiều nên vị bị nhạt. Hy vọng quán cải thiện ở lần sau.' },
    { id: 'r5', name: 'Hà My', avatar: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?q=80&w=120', rating: 1, comment: 'Không hợp khẩu vị của mình, vị đắng hơn mong đợi.' },
    { id: 'r6', name: 'Đức Trí', avatar: 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?q=80&w=120', rating: 5, comment: 'Best seller xứng đáng! Hương vị cân bằng, uống lạnh rất ngon.' },
  ]);
  const slideUpAnim = useRef(new Animated.Value(50)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const ownedDiscountVouchers = [
    { id: 'd1', title: 'Giảm 15% tối đa 40.000đ', type: 'percent', value: 15, maxDiscount: 40000, minOrder: 50000 },
    { id: 'd2', title: 'Giảm trực tiếp 30.000đ', type: 'amount', value: 30000, minOrder: 99000 },
  ];

  const ownedShippingVouchers = [
    { id: 's1', title: 'Freeship tối đa 15.000đ', type: 'free_ship', value: 15000, minOrder: 50000 },
  ];

  // Hiệu ứng trượt lên và rõ dần cho phần nội dung
  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideUpAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const increaseQuantity = () => setQuantity(prev => prev + 1);
  const decreaseQuantity = () => setQuantity(prev => (prev > 1 ? prev - 1 : 1));

  const renderStars = (rating, size = 14) => (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Ionicons
          key={star}
          name={star <= rating ? 'star' : 'star-outline'}
          size={size}
          color="#D4AF37"
          style={{ marginRight: 3 }}
        />
      ))}
    </View>
  );

  const handleSubmitReview = () => {
    if (!hasPurchased) {
      Alert.alert('Chưa thể đánh giá', 'Bạn cần mua hàng trước khi gửi đánh giá.');
      return;
    }
    if (!reviewText.trim()) {
      Alert.alert('Thiếu nội dung', 'Vui lòng nhập nội dung đánh giá.');
      return;
    }

    const newReview = {
      id: `r-${Date.now()}`,
      name: 'Bạn',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=120',
      rating: myRating,
      comment: reviewText.trim(),
    };

    setReviews((prev) => [newReview, ...prev]);
    setReviewText('');
    setMyRating(5);
    Alert.alert('Thành công', 'Đánh giá của bạn đã được gửi.');
  };

  const handleBuyNow = () => {
    setCheckoutMode('buy');
    setPaymentMethod('cod');
    setVoucherModalVisible(true);
  };

  const handleAddToCart = () => {
    setCheckoutMode('cart');
    setVoucherModalVisible(true);
  };

  const calculateInvoice = () => {
    const subtotal = parsePrice(item.price) * quantity;
    let discountAmount = 0;
    const baseShippingFee = 15000;
    let shippingDiscount = 0;

    const discountVoucher = ownedDiscountVouchers.find((v) => v.id === selectedDiscountVoucher);
    if (discountVoucher && subtotal >= discountVoucher.minOrder) {
      if (discountVoucher.type === 'percent') {
        discountAmount = Math.floor((subtotal * discountVoucher.value) / 100);
        discountAmount = Math.min(discountAmount, discountVoucher.maxDiscount || discountAmount);
      } else {
        discountAmount = discountVoucher.value;
      }
    }

    const shippingVoucher = ownedShippingVouchers.find((v) => v.id === selectedShippingVoucher);
    if (shippingVoucher && subtotal >= shippingVoucher.minOrder) {
      shippingDiscount = Math.min(baseShippingFee, shippingVoucher.value);
    }

    const shippingFeeAfterDiscount = Math.max(0, baseShippingFee - shippingDiscount);
    const finalTotal = Math.max(0, subtotal - discountAmount + shippingFeeAfterDiscount);

    return {
      subtotal,
      discountAmount,
      baseShippingFee,
      shippingDiscount,
      shippingFeeAfterDiscount,
      finalTotal,
    };
  };

  const handleConfirmCheckout = () => {
    if (checkoutMode === 'buy' && !deliveryAddress.trim()) {
      Alert.alert('Thiếu địa chỉ', 'Vui lòng nhập địa chỉ nhận hàng.');
      return;
    }

    const invoice = calculateInvoice();
    const paymentLabel = paymentMethod === 'vnpay' ? 'Thanh toán bằng VNPAY' : 'Thanh toán khi nhận hàng';
    const invoiceText = `Tạm tính: ${invoice.subtotal.toLocaleString('vi-VN')} đ\nGiảm giá voucher: -${invoice.discountAmount.toLocaleString('vi-VN')} đ\nPhí ship: ${invoice.baseShippingFee.toLocaleString('vi-VN')} đ\nGiảm phí ship: -${invoice.shippingDiscount.toLocaleString('vi-VN')} đ\nTổng thanh toán: ${invoice.finalTotal.toLocaleString('vi-VN')} đ`;

    Alert.alert(
      checkoutMode === 'buy' ? 'Xác nhận mua ngay' : 'Xác nhận thêm vào giỏ',
      `${item.name} x${quantity}\nHình thức thanh toán: ${paymentLabel}\n\n${invoiceText}`,
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Xác nhận',
          onPress: () => {
            setVoucherModalVisible(false);

            if (checkoutMode === 'cart') {
              const newCartItem = {
                id: `cart-${Date.now()}`,
                name: item.name,
                price: parsePrice(item.price),
                image: item.image,
                quantity,
              };
              Alert.alert('Đã thêm vào giỏ', `Áp dụng ưu đãi thành công.\n\n${invoiceText}`);
              navigation.navigate('Cart', { newItem: newCartItem });
              return;
            }

            // TẠO THÔNG TIN ĐƠN HÀNG
            const now = new Date();
            const hh = String(now.getHours()).padStart(2, '0');
            const mm = String(now.getMinutes()).padStart(2, '0');
            const dd = String(now.getDate()).padStart(2, '0');
            const mo = String(now.getMonth() + 1).padStart(2, '0');
            const yyyy = now.getFullYear();
            const orderCode = `TJ-${now.getTime().toString().slice(-6)}`;

            const newOrder = {
              id: orderCode,
              date: `${hh}:${mm} • ${dd}/${mo}/${yyyy}`,
              status: 'preparing',
              type: 'Delivery',
              total: `${invoice.finalTotal.toLocaleString('vi-VN')} đ`,
              itemCount: quantity,
              mainItem: item.name,
              payment: paymentMethod === 'vnpay' ? 'Đã thanh toán (VNPAY)' : 'Thanh toán khi nhận',
              address: deliveryAddress.trim(),
              image: item.image,
            };

            // KIỂM TRA PHƯƠNG THỨC THANH TOÁN
            if (paymentMethod === 'vnpay') {
              // Nếu là VNPAY, chuyển hướng sang màn hình WebView thanh toán
              navigation.push('VNPayScreen', {
                amount: invoice.finalTotal,
                orderInfo: `Thanh toan don hang ${orderCode}`,
                newOrder: newOrder,
              });
            } else {
              // Nếu là COD, hoàn tất ngay lập tức
              setHasPurchased(true);
              Alert.alert('Đặt hàng thành công', `Đơn hàng đang ở trạng thái: Đang chuẩn bị.\nHình thức thanh toán: ${paymentLabel}\n\n${invoiceText}`);
              navigation.navigate('MainTabs', {
                screen: 'Đặt Hàng',
                params: { newOrder },
              });
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }] }>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />

      {/* ẢNH SẢN PHẨM TRÀN VIỀN */}
      <View style={styles.imageContainer}>
        <Image source={imageSource} style={styles.productImage} />
        {/* Lớp gradient đen từ dưới lên để hòa trộn mượt mà với nền */}
        <View style={styles.gradientOverlay} />
      </View>

      {/* HEADER NÚT BACK (Nổi trên ảnh) */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color="#D4AF37" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconButton}>
          <Ionicons name="heart-outline" size={26} color="#D4AF37" />
        </TouchableOpacity>
      </View>

      {/* NỘI DUNG CHI TIẾT SẢN PHẨM */}
      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
      >
        <Animated.View 
          style={[styles.detailsContainer, { opacity: fadeAnim, transform: [{ translateY: slideUpAnim }] }]}
        >
          {/* Tên và Giá */}
          <View style={styles.titleRow}>
            <Text style={styles.productName}>{item.name}</Text>
          </View>
          <Text style={styles.productPrice}>{item.price}</Text>

          {/* Đường kẻ ngang trang trí */}
          <View style={styles.divider} />

          {/* Mô tả */}
          <Text style={styles.sectionTitle}>Mô tả hương vị</Text>
          <Text style={styles.descriptionText}>
            {item.description || 'Hương vị tuyệt hảo được pha chế từ những nguyên liệu thượng hạng nhất, mang đến cho bạn trải nghiệm xa xỉ đích thực.'}
          </Text>

          {/* Chỉnh số lượng */}
          <View style={styles.quantitySection}>
            <Text style={styles.quantityLabel}>Số lượng:</Text>
            <View style={styles.quantityControl}>
              <TouchableOpacity style={styles.qtyBtn} onPress={decreaseQuantity}>
                <Feather name="minus" size={20} color="#D4AF37" />
              </TouchableOpacity>
              <Text style={styles.qtyText}>{quantity}</Text>
              <TouchableOpacity style={styles.qtyBtn} onPress={increaseQuantity}>
                <Feather name="plus" size={20} color="#D4AF37" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.reviewSection}>
            <Text style={styles.sectionTitle}>Đánh giá từ khách hàng</Text>
            {reviews.map((review) => (
              <View key={review.id} style={styles.reviewCard}>
                <View style={styles.reviewTopRow}>
                  <View style={styles.reviewUserRow}>
                    <Image source={{ uri: review.avatar }} style={styles.reviewAvatar} />
                    <Text style={styles.reviewName}>{review.name}</Text>
                  </View>
                  {renderStars(review.rating)}
                </View>
                <Text style={styles.reviewComment}>{review.comment}</Text>
              </View>
            ))}

            {hasPurchased ? (
              <View style={styles.writeReviewBox}>
                <Text style={styles.writeTitle}>Viết đánh giá của bạn</Text>
                <View style={styles.ratingPickRow}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity key={star} onPress={() => setMyRating(star)}>
                      <Ionicons
                        name={star <= myRating ? 'star' : 'star-outline'}
                        size={22}
                        color="#D4AF37"
                        style={{ marginRight: 6 }}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  style={styles.reviewInput}
                  value={reviewText}
                  onChangeText={setReviewText}
                  placeholder="Nhập đánh giá của bạn..."
                  placeholderTextColor="#888"
                  multiline
                />
                <TouchableOpacity style={styles.sendReviewBtn} onPress={handleSubmitReview}>
                  <Text style={styles.sendReviewText}>Gửi đánh giá</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.lockedReviewBox}>
                <Text style={styles.lockedReviewText}>Bạn cần mua hàng trước khi được viết đánh giá.</Text>
              </View>
            )}
          </View>
        </Animated.View>
      </ScrollView>

      {/* BOTTOM ACTION BAR (Cố định ở dưới cùng) */}
      <Animated.View style={[styles.bottomBar, { opacity: fadeAnim }]}>
        <TouchableOpacity style={styles.addToCartBtn} onPress={handleAddToCart}>
          <Text style={styles.addToCartText}>THÊM VÀO GIỎ</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.buyNowBtn} onPress={handleBuyNow}>
          <Text style={styles.buyNowText}>MUA NGAY</Text>
        </TouchableOpacity>
      </Animated.View>

      <Modal
        visible={voucherModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setVoucherModalVisible(false)}
      >
        <View style={styles.voucherModalOverlay}>
          <View style={styles.voucherModalCard}>
            <Text style={styles.voucherModalTitle}>Chọn ưu đãi áp dụng</Text>

            <Text style={styles.voucherGroupTitle}>Voucher giảm giá</Text>
            {ownedDiscountVouchers.map((v) => {
              const selected = selectedDiscountVoucher === v.id;
              return (
                <TouchableOpacity
                  key={v.id}
                  style={[styles.voucherOption, selected && styles.voucherOptionSelected]}
                  onPress={() => setSelectedDiscountVoucher(selected ? null : v.id)}
                >
                  <Text style={styles.voucherOptionText}>{v.title}</Text>
                  <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={20} color="#D4AF37" />
                </TouchableOpacity>
              );
            })}

            <Text style={styles.voucherGroupTitle}>Voucher freeship</Text>
            {ownedShippingVouchers.map((v) => {
              const selected = selectedShippingVoucher === v.id;
              return (
                <TouchableOpacity
                  key={v.id}
                  style={[styles.voucherOption, selected && styles.voucherOptionSelected]}
                  onPress={() => setSelectedShippingVoucher(selected ? null : v.id)}
                >
                  <Text style={styles.voucherOptionText}>{v.title}</Text>
                  <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={20} color="#D4AF37" />
                </TouchableOpacity>
              );
            })}

            {checkoutMode === 'buy' ? (
              <>
                <Text style={styles.voucherGroupTitle}>Địa chỉ nhận hàng</Text>
                <TextInput
                  value={deliveryAddress}
                  onChangeText={setDeliveryAddress}
                  placeholder="Nhập địa chỉ nhận hàng"
                  placeholderTextColor="#9CA3AF"
                  style={styles.addressInput}
                  multiline
                />

                <Text style={styles.voucherGroupTitle}>Hình thức thanh toán</Text>
                <View style={styles.paymentMethodRow}>
                  <TouchableOpacity
                    style={[styles.paymentMethodBtn, paymentMethod === 'cod' && styles.paymentMethodBtnActive]}
                    onPress={() => setPaymentMethod('cod')}
                  >
                    <Text style={[styles.paymentMethodText, paymentMethod === 'cod' && styles.paymentMethodTextActive]}>
                      Thanh toán khi nhận hàng
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.paymentMethodBtn, paymentMethod === 'vnpay' && styles.paymentMethodBtnActive]}
                    onPress={() => setPaymentMethod('vnpay')}
                  >
                    <Text style={[styles.paymentMethodText, paymentMethod === 'vnpay' && styles.paymentMethodTextActive]}>
                      VNPAY
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : null}

            <View style={styles.voucherActionRow}>
              <TouchableOpacity style={styles.voucherCancelBtn} onPress={() => setVoucherModalVisible(false)}>
                <Text style={styles.voucherCancelText}>Đóng</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.voucherApplyBtn} onPress={handleConfirmCheckout}>
                <Text style={styles.voucherApplyText}>Áp dụng & xác nhận</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  imageContainer: {
    width: width,
    height: height * 0.55, // Chiếm 55% màn hình
    position: 'absolute',
    top: 0,
  },
  productImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  gradientOverlay: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    height: 150,
    // Hiệu ứng gradient mờ dần (mô phỏng bằng màu rgba tối dần)
    backgroundColor: 'rgba(10,10,10,0.6)', 
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    position: 'absolute',
    top: 0,
    width: '100%',
    zIndex: 10,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(10, 10, 10, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    // Blur effect bằng shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
  },
  scrollContent: {
    paddingTop: height * 0.45, // Bắt đầu nội dung từ nửa dưới ảnh
    paddingBottom: 120, // Chừa chỗ cho Bottom Bar
  },
  detailsContainer: {
    backgroundColor: '#0A0A0A',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingHorizontal: 25,
    paddingTop: 35,
    minHeight: height * 0.6,
    // Tạo viền sáng mờ ở đỉnh khối
    borderTopWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 20,
  },
  titleRow: {
    marginBottom: 10,
  },
  productName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 0.5,
    lineHeight: 36,
  },
  productPrice: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#D4AF37', // Vàng Gold
    marginBottom: 25,
    textShadowColor: 'rgba(212, 175, 55, 0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#D4AF37',
    marginBottom: 10,
  },
  descriptionText: {
    fontSize: 15,
    color: '#A9A9A9',
    lineHeight: 24,
    marginBottom: 35,
  },
  quantitySection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.15)',
  },
  quantityLabel: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: '600',
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qtyBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.5)',
  },
  qtyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    marginHorizontal: 20,
    width: 25,
    textAlign: 'center',
  },
  reviewSection: {
    marginTop: 24,
  },
  reviewCard: {
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.18)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  reviewTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  reviewUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.4)',
  },
  reviewName: {
    color: '#FFF',
    fontWeight: '700',
  },
  reviewComment: {
    color: '#CFCFCF',
    lineHeight: 20,
    fontSize: 13,
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  writeReviewBox: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.22)',
    borderRadius: 14,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  writeTitle: {
    color: '#FFF',
    fontWeight: '700',
    marginBottom: 8,
  },
  ratingPickRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  reviewInput: {
    minHeight: 90,
    color: '#FFF',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10,
    padding: 10,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  sendReviewBtn: {
    backgroundColor: '#D4AF37',
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
  },
  sendReviewText: {
    color: '#1A1A1A',
    fontWeight: '800',
  },
  lockedReviewBox: {
    marginTop: 10,
    borderRadius: 10,
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  lockedReviewText: {
    color: '#B8B8B8',
    fontSize: 13,
  },
  // --- BOTTOM BAR ---
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 35,
    backgroundColor: 'rgba(10, 10, 10, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(212, 175, 55, 0.2)',
  },
  addToCartBtn: {
    flex: 1,
    height: 55,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#D4AF37',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
    backgroundColor: 'rgba(212, 175, 55, 0.05)',
  },
  addToCartText: {
    color: '#D4AF37',
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  buyNowBtn: {
    flex: 1,
    height: 55,
    borderRadius: 15,
    backgroundColor: '#D4AF37',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  buyNowText: {
    color: '#1A1A1A',
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  voucherModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  voucherModalCard: {
    backgroundColor: '#111111',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    borderTopWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
  },
  voucherModalTitle: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 12,
  },
  voucherGroupTitle: {
    color: '#D4AF37',
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 6,
  },
  voucherOption: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  voucherOptionSelected: {
    borderColor: '#D4AF37',
    backgroundColor: 'rgba(212,175,55,0.1)',
  },
  voucherOptionText: {
    color: '#EFEFEF',
    flex: 1,
    marginRight: 10,
    fontSize: 13,
  },
  addressInput: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: '#FFF',
    minHeight: 54,
    marginBottom: 8,
    textAlignVertical: 'top',
  },
  paymentMethodRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  paymentMethodBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginRight: 8,
    alignItems: 'center',
  },
  paymentMethodBtnActive: {
    borderColor: '#D4AF37',
    backgroundColor: 'rgba(212,175,55,0.12)',
  },
  paymentMethodText: {
    color: '#E5E7EB',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  paymentMethodTextActive: {
    color: '#D4AF37',
  },
  voucherActionRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  voucherCancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#666',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginRight: 8,
  },
  voucherCancelText: {
    color: '#DDD',
    fontWeight: '700',
  },
  voucherApplyBtn: {
    flex: 1.6,
    backgroundColor: '#D4AF37',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  voucherApplyText: {
    color: '#1A1A1A',
    fontWeight: '800',
  },
});

export default ProductDetailScreen;