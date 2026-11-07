import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator, Alert, SafeAreaView, Text, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';
import { useUserProfile } from '../context/UserProfileContext';
import { useCart } from '../context/CartContext';
import { apiUrl, BASE_URL } from '../config/api';
import { paymentDetails, isPaymentNavigationAllowed, isPaymentReturn } from '../config/paymentTransport';

const transportOptions = { apiBase: BASE_URL, development: typeof __DEV__ !== 'undefined' && __DEV__ };

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
  const paymentOrder = useRef(null);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(false);

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
            receiverName: receiverName || 'Khách đặt bàn',
            receiverPhone: receiverPhone || 'N/A',
            deliveryAddress: deliveryAddress || 'Tại cửa hàng',
            note,
            voucherId,
            cartItems: cartItemsParam,
            type: route.params?.reservationData ? 'reservation' : 'order',
          }),
        });

        const data = await response.json();
        if (!response.ok || typeof data?.paymentUrl !== 'string' || !data.paymentUrl.trim()) {
          throw new Error(data?.message || 'Không lấy được link thanh toán VNPAY');
        }

        const payment = paymentDetails(data, transportOptions);
        paymentOrder.current = payment;
        setPaymentUrl(payment.paymentUrl);
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

  const verifyPaymentResult = async () => {
    if (checkingPayment || !paymentOrder.current) return;
    setCheckingPayment(true);
    try {
      const response = await fetch(apiUrl(`/api/orders/${paymentOrder.current.id}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Chưa thể xác nhận thanh toán.');
      if (data.order.paymentStatus === 'pending') {
        setAwaitingConfirmation(true);
        return;
      }
      if (data.order.paymentStatus !== 'paid') {
        Alert.alert('Thất bại', 'Thanh toán chưa thành công.');
        navigation.goBack();
        return;
      }
      const reservationData = route.params?.reservationData;
      if (reservationData) {
        Alert.alert('Thành công', 'Đặt cọc bàn thành công!', [
          {
            text: 'Quay lại Cửa hàng',
            onPress: () => navigation.navigate('MainTabs', {
              screen: 'Cửa Hàng',
              params: { reservationResult: reservationData },
            }),
          },
        ]);
      } else {
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
      }
    } catch (error) {
      setAwaitingConfirmation(true);
      Alert.alert('Chưa thể xác nhận', error.message);
    } finally {
      setCheckingPayment(false);
    }
  };

  const handleNavigationStateChange = ({ url }) => {
    if (!url || hasHandledResult.current || !paymentOrder.current) return;
    if (!isPaymentReturn(url, paymentOrder.current)) return;
    hasHandledResult.current = true;
    verifyPaymentResult();
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

  if (awaitingConfirmation) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.loadingText}>Đang chờ xác nhận thanh toán từ VNPay.</Text>
        <TouchableOpacity style={styles.homeBtn} disabled={checkingPayment} onPress={verifyPaymentResult}>
          <Text style={styles.homeBtnText}>{checkingPayment ? 'Đang kiểm tra...' : 'Kiểm tra lại'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.homeBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.homeBtnText}>Quay lại</Text>
        </TouchableOpacity>
      </SafeAreaView>
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
        // The library opens URLs outside this list through Linking before calling our guard.
        // Route every scheme to the guard so rejected schemes stay blocked.
        originWhitelist={['*']}
        onShouldStartLoadWithRequest={({ url }) => isPaymentNavigationAllowed(url, paymentOrder.current, transportOptions)}
        mixedContentMode="never"
        allowFileAccess={false}
        allowFileAccessFromFileURLs={false}
        allowUniversalAccessFromFileURLs={false}
        javaScriptCanOpenWindowsAutomatically={false}
        setSupportMultipleWindows={false}
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