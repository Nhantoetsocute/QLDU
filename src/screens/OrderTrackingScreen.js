import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme/ThemeContext';

const STATUS_ITEMS = [
  { id: 'preparing', label: 'Đang chuẩn bị' },
  { id: 'shipping', label: 'Đang giao' },
  { id: 'delivered', label: 'Đã giao' },
  { id: 'cancelled', label: 'Đã hủy', danger: true },
];

const StepItem = ({ label, active, danger, isDarkMode }) => (
  <View
    style={[
      styles.stepRow,
      active && styles.stepRowActive,
      active && !danger && (isDarkMode ? styles.stepRowActiveDark : styles.stepRowActiveLight),
      active && danger && styles.stepRowDanger,
    ]}
  >
    <View style={[styles.stepDot, active && styles.stepDotActive, danger && active && styles.stepDotDanger]} />
    <Text
      style={[
        styles.stepLabel,
        active && styles.stepLabelActive,
        active && !danger && (isDarkMode ? styles.stepLabelActiveDark : styles.stepLabelActiveLight),
        danger && active && styles.stepLabelDanger,
      ]}
    >
      {label}
    </Text>
  </View>
);

const OrderTrackingScreen = ({ navigation, route }) => {
  const { isDarkMode, colors } = useAppTheme();

  const orderId = route.params?.orderId || '---';
  const orderType = route.params?.type || '---';
  const orderTotal = route.params?.total || '---';
  const orderPayment = route.params?.payment || '---';
  const mainItem = route.params?.mainItem || 'Đơn hàng của bạn';
  const [currentStatus, setCurrentStatus] = useState(route.params?.status || 'preparing');
  const currentStatusLabel = STATUS_ITEMS.find((s) => s.id === currentStatus)?.label || 'Không xác định';

  const canCancel = currentStatus === 'preparing';

  const handleCancelOrder = () => {
    Alert.alert(
      'Xác nhận hủy đơn',
      `Bạn có chắc muốn hủy đơn ${orderId}?`,
      [
        { text: 'Không', style: 'cancel' },
        {
          text: 'Hủy đơn',
          style: 'destructive',
          onPress: () => {
            setCurrentStatus('cancelled');
            Alert.alert('Thành công', 'Đơn hàng đã được hủy.');
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#D4AF37" />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Theo dõi đơn hàng</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="package-variant-closed" size={36} color={colors.accent} />
          <Text style={[styles.orderId, { color: colors.accent }]}>Mã đơn: {orderId}</Text>
          <Text style={styles.infoText}>Sản phẩm chính: {mainItem}</Text>
          <Text style={styles.infoText}>Hình thức: {orderType}</Text>
          <Text style={styles.infoText}>Thanh toán: {orderPayment}</Text>
          <Text style={styles.infoText}>Tổng đơn: {orderTotal}</Text>
          <Text style={styles.statusText}>
            Trạng thái hiện tại: {currentStatusLabel}
          </Text>

          <View style={styles.stepsWrap}>
            {STATUS_ITEMS.map((status) => (
              <StepItem
                key={status.id}
                label={status.label}
                active={currentStatus === status.id}
                danger={status.danger}
                isDarkMode={isDarkMode}
              />
            ))}
          </View>

          {canCancel ? (
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancelOrder}>
              <Text style={styles.cancelButtonText}>HỦY ĐƠN HÀNG</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.viewOnlyBox}>
              <Text style={styles.viewOnlyText}>Đơn hàng ở trạng thái này chỉ có thể xem, không thể hủy.</Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A' },
  safeArea: { flex: 1, paddingHorizontal: 20 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 20,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(212,175,55,0.1)',
  },
  title: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  card: {
    marginTop: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.25)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 18,
  },
  orderId: {
    color: '#D4AF37',
    marginTop: 10,
    marginBottom: 8,
    fontSize: 16,
    fontWeight: '700',
  },
  statusText: {
    color: '#A9A9A9',
    marginBottom: 16,
    fontSize: 13,
  },
  infoText: {
    color: '#A9A9A9',
    marginBottom: 4,
    fontSize: 13,
  },
  stepsWrap: { gap: 12 },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  stepRowActive: {
    borderWidth: 1,
  },
  stepRowActiveDark: {
    backgroundColor: 'rgba(46, 204, 113, 0.18)',
    borderColor: 'rgba(46, 204, 113, 0.45)',
  },
  stepRowActiveLight: {
    backgroundColor: 'rgba(46, 204, 113, 0.14)',
    borderColor: 'rgba(39, 174, 96, 0.55)',
  },
  stepRowDanger: {
    backgroundColor: 'rgba(231, 76, 60, 0.14)',
    borderColor: 'rgba(231, 76, 60, 0.55)',
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#555',
    marginRight: 10,
  },
  stepDotActive: { backgroundColor: '#2ECC71' },
  stepDotDanger: { backgroundColor: '#E74C3C' },
  stepLabel: { color: '#A9A9A9', fontSize: 14 },
  stepLabelActive: { fontWeight: '700' },
  stepLabelActiveDark: { color: '#ECFDF5' },
  stepLabelActiveLight: { color: '#065F46' },
  stepLabelDanger: { color: '#E74C3C' },
  cancelButton: {
    marginTop: 20,
    backgroundColor: 'rgba(231,76,60,0.15)',
    borderWidth: 1,
    borderColor: '#E74C3C',
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelButtonText: {
    color: '#E74C3C',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  viewOnlyBox: {
    marginTop: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    padding: 12,
  },
  viewOnlyText: {
    color: '#BDBDBD',
    fontSize: 13,
    textAlign: 'center',
  },
});

export default OrderTrackingScreen;
