import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator, Alert, SafeAreaView, Text, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';
import { useUserProfile } from '../context/UserProfileContext';
import { useCart } from '../context/CartContext';
import { apiUrl } from '../config/api';

const VNPayScreen = ({ route, navigation }) => {
  const {
    amount,
    orderInfo,
    receiverName,
    receiverPhone,
    deliveryAddress,
    note,
    voucherId,
    cartItems: cartItemsParam,
  } = route.params || {};

  const { token } = useUserProfile();
  const { clearCart } = useCart();

  const [paymentUrl, setPaymentUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const hasHandledResult = useRef(false);

  useEffect(() => {
    const createPaymentUrl = async () => {
      try {
        const response = await fetch(apiUrl('/api/vnpay/create-payment-url'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            amount,
            orderInfo,
            receiverName,
            receiverPhone,
            deliveryAddress,
            note,
            voucherId,
            cartItems: cartItemsParam,
          }),
        });

        const data = await response.json();
        if (!response.ok || typeof data?.paymentUrl !== 'string' || !data.paymentUrl.trim()) {
          throw new Error(data?.message || 'Không lấy được link thanh toán VNPAY');
        }

        setPaymentUrl(data.paymentUrl.trim());
      } catch (error) {
        console.error('VNPay create URL error:', error);
        setLoadError('Không thể tạo liên kết thanh toán VNPAY. Vui lòng thử lại sau.');
        Alert.alert('Lỗi thanh toán', error.message || 'Không thể mở VNPAY.', [
          {
            text: 'Về Trang Chủ',
            onPress: () => navigation.navigate('MainTabs', { screen: 'Trang Chủ' }),
          },
          { text: 'Quay lại', onPress: () => navigation.goBack() },
        ]);
      } finally {
        setLoading(false);
      }
    };

    createPaymentUrl();
  }, []);

  const getQueryParam = (url, key) => {
    const match = url.match(new RegExp(`[?&]${key}=([^&]+)`));
    return match ? decodeURIComponent(match[1]) : null;
  };

  const handleNavigationStateChange = (navState) => {
    const { url } = navState;

    // Khi VNPay redirect về returnUrl từ backend (chứa vnp_ResponseCode)
    if (!url || !url.includes('vnp_ResponseCode=')) return;

    // Tránh xử lý nhiều lần (WebView gọi onNavigationStateChange 2+ lần)
    if (hasHandledResult.current) return;
    hasHandledResult.current = true;

    const responseCode = getQueryParam(url, 'vnp_ResponseCode');
    if (responseCode === '00') {
      // Thanh toán thành công → xoá giỏ hàng + navigate về danh sách đơn hàng (refresh từ DB)
      clearCart();
      Alert.alert(' Thành công', 'Thanh toán VNPAY thành công!', [
        {
          text: 'Xem đơn hàng',
          onPress: () => navigation.navigate('MainTabs', {
            screen: 'Đặt Hàng',
            params: { refresh: Date.now() },
          }),
        },
      ]);
    } else {
      Alert.alert('Thất bại', 'Giao dịch bị huỷ hoặc có lỗi xảy ra.');
      navigation.goBack();
    }
  };

  const handleWebViewError = () => {
    setLoadError('Đã xảy ra lỗi khi tải cổng thanh toán VNPAY.');
    Alert.alert('Lỗi tải trang', 'Không thể mở cổng VNPAY.', [
      {
        text: 'Về Trang Chủ',
        onPress: () => navigation.navigate('MainTabs', { screen: 'Trang Chủ' }),
      },
      { text: 'Ở lại' },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#D4AF37" />
        <Text style={styles.loadingText}>Đang tạo liên kết thanh toán...</Text>
      </View>
    );
  }

  if (typeof paymentUrl !== 'string' || !paymentUrl.trim()) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.errorText}>{loadError || 'Không thể mở cổng thanh toán VNPAY.'}</Text>
        <TouchableOpacity
          style={styles.homeBtn}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.homeBtnText}>Quay lại</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <WebView
        source={{ uri: paymentUrl.trim() }}
        originWhitelist={['*']}
        onNavigationStateChange={handleNavigationStateChange}
        onError={handleWebViewError}
        onHttpError={handleWebViewError}
        startInLoadingState={true}
        renderLoading={() => (
          <ActivityIndicator style={styles.webviewLoader} size="large" color="#D4AF37" />
        )}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A0A0A',
  },
  loadingText: {
    color: '#D4AF37',
    marginTop: 16,
    fontSize: 14,
  },
  webviewLoader: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -20,
    marginTop: -20,
  },
  errorText: {
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 16,
    fontSize: 15,
    paddingHorizontal: 20,
  },
  homeBtn: {
    backgroundColor: '#D4AF37',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
  },
  homeBtnText: {
    color: '#1A1A1A',
    fontWeight: '700',
  },
});

export default VNPayScreen;