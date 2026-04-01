import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Alert, SafeAreaView, Text, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';

// Đổi URL này thành backend thật của bạn
const CREATE_VNPAY_URL_API = 'https://your-backend-domain.com/api/vnpay/create-payment-url';

const VNPayScreen = ({ route, navigation }) => {
  const { amount, orderInfo, newOrder } = route.params || {};
  const [paymentUrl, setPaymentUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const createPaymentUrl = async () => {
      try {
        const response = await fetch(CREATE_VNPAY_URL_API, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount,
            orderInfo,
            orderId: newOrder?.id,
          }),
        });

        const data = await response.json();
        if (!response.ok || typeof data?.paymentUrl !== 'string' || !data.paymentUrl.trim()) {
          throw new Error(data?.message || 'Không lấy được link thanh toán VNPAY');
        }

        setPaymentUrl(data.paymentUrl.trim());
      } catch (error) {
        setLoadError('Không thể tạo liên kết thanh toán VNPAY. Vui lòng thử lại sau.');
        Alert.alert('Lỗi thanh toán', 'Không thể mở VNPAY. Bạn có thể quay về Trang Chủ.', [
          {
            text: 'Về Trang Chủ',
            onPress: () => navigation.navigate('MainTabs', { screen: 'Trang Chủ' }),
          },
        ]);
      } finally {
        setLoading(false);
      }
    };

    createPaymentUrl();
  }, [amount, navigation, newOrder?.id, orderInfo]);

  const getQueryParam = (url, key) => {
    const match = url.match(new RegExp(`[?&]${key}=([^&]+)`));
    return match ? decodeURIComponent(match[1]) : null;
  };

  const handleNavigationStateChange = (navState) => {
    const { url } = navState;

    // Khi VNPAY redirect về returnUrl từ backend
    if (!url || !url.includes('vnp_ResponseCode=')) return;

    const responseCode = getQueryParam(url, 'vnp_ResponseCode');
    if (responseCode === '00') {
      Alert.alert('Thành công', 'Thanh toán VNPAY thành công!');
      navigation.navigate('MainTabs', {
        screen: 'Đặt Hàng',
        params: { newOrder },
      });
    } else {
      Alert.alert('Thất bại', 'Giao dịch bị huỷ hoặc có lỗi xảy ra.');
      navigation.goBack();
    }
  };

  const handleWebViewError = () => {
    setLoadError('Đã xảy ra lỗi khi tải cổng thanh toán VNPAY.');
    Alert.alert('Lỗi tải trang', 'Không thể mở cổng VNPAY. Bạn có thể quay về Trang Chủ.', [
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
      </View>
    );
  }

  if (typeof paymentUrl !== 'string' || !paymentUrl.trim()) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.errorText}>{loadError || 'Không thể mở cổng thanh toán VNPAY.'}</Text>
        <TouchableOpacity
          style={styles.homeBtn}
          onPress={() => navigation.navigate('MainTabs', { screen: 'Trang Chủ' })}
        >
          <Text style={styles.homeBtnText}>Về Trang Chủ</Text>
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
  }
});

export default VNPayScreen;