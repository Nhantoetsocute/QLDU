import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  Image,
  TouchableOpacity,
  TextInput,
  Modal,
  Linking,
  StatusBar,
  Platform,
  Alert,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';
import { useAppTheme } from '../theme/ThemeContext';

const ORANGE_COLOR = '#E57905';
const DEPOSIT_AMOUNT = 100000;
const timeSlots = ['08:00 - 10:00', '10:00 - 12:00', '14:00 - 16:00', '18:00 - 20:00'];
const tableNumbers = Array.from({ length: 12 }, (_, i) => i + 1);

const isTableAvailable = (storeId, slot, tableNo) => {
  const slotSeed = slot.split('').reduce((sum, c) => sum + c.charCodeAt(0), 0);
  const seed = Number(storeId) * 17 + slotSeed + tableNo * 13;
  return seed % 4 !== 0;
};

// --- DỮ LIỆU THẬT CHI NHÁNH ---
// Tọa độ và link embed đã được fix cứng theo vị trí thực tế tại Hà Nội
const mockStores = [
  {
    id: '1',
    name: 'True Juice Thái Hà',
    address: '12 Thái Hà, Trung Liệt, Đống Đa, Hà Nội',
    distance: '1.2 km',
    status: 'Đang mở cửa',
    time: '07:00 - 22:30',
    phone: '024 1234 5678',
    image: require('../../assets/images/nen1.png'),
    amenities: ['Wifi miễn phí', 'Chỗ để xe máy', 'Thanh toán thẻ'],
    // URL Nhúng bản đồ thật của khu vực 12 Thái Hà
    mapEmbedUrl: 'https://maps.google.com/maps?q=12+Thái+Hà,+Đống+Đa,+Hà+Nội&hl=vi&z=16&output=embed',
    lat: 21.011311,
    lng: 105.819779,
  },
  {
    id: '2',
    name: 'True Juice Cầu Giấy',
    address: '89 Cầu Giấy, Quan Hoa, Cầu Giấy, Hà Nội',
    distance: '3.5 km',
    status: 'Đang mở cửa',
    time: '07:00 - 23:00',
    phone: '024 8765 4321',
    image: require('../../assets/images/nen2.png'),
    amenities: ['Wifi miễn phí', 'Có chỗ đỗ ô tô', 'Khu vực hút thuốc'],
    // URL Nhúng bản đồ thật của khu vực 89 Cầu Giấy
    mapEmbedUrl: 'https://maps.google.com/maps?q=89+Cầu+Giấy,+Quan+Hoa,+Hà+Nội&hl=vi&z=16&output=embed',
    lat: 21.031589,
    lng: 105.799014,
  },
  {
    id: '3',
    name: 'True Juice Hai Bà Trưng',
    address: '45 Hai Bà Trưng, Hoàn Kiếm, Hà Nội',
    distance: '5.1 km',
    status: 'Đang mở cửa',
    time: '08:00 - 21:00',
    phone: '024 9999 8888',
    image: require('../../assets/images/nen3.png'),
    amenities: ['View đẹp', 'Thanh toán thẻ', 'Gần phố đi bộ'],
    mapEmbedUrl: 'https://maps.google.com/maps?q=45+Hai+Bà+Trưng,+Hoàn+Kiếm,+Hà+Nội&hl=vi&z=16&output=embed',
    lat: 21.026364,
    lng: 105.850231,
  },
  {
    id: '4',
    name: 'True Juice Ba Đình',
    address: '78 Quán Thánh, Ba Đình, Hà Nội',
    distance: '2.8 km',
    status: 'Đang mở cửa',
    time: '07:00 - 22:00',
    phone: '024 5555 6666',
    image: require('../../assets/images/nen4.png'),
    amenities: ['Wifi miễn phí', 'Không gian rộng', 'Nhạc sống'],
    mapEmbedUrl: 'https://maps.google.com/maps?q=78+Quán+Thánh,+Ba+Đình,+Hà+Nội&hl=vi&z=16&output=embed',
    lat: 21.049267,
    lng: 105.833740,
  },
  {
    id: '5',
    name: 'True Juice Hoàng Mai',
    address: '120 Giải Phóng, Hoàng Mai, Hà Nội',
    distance: '6.2 km',
    status: 'Đang mở cửa',
    time: '07:30 - 21:30',
    phone: '024 7777 8888',
    image: require('../../assets/images/nen5.png'),
    amenities: ['Chỗ để xe máy', 'Thanh toán thẻ', 'Nước lạnh'],
    mapEmbedUrl: 'https://maps.google.com/maps?q=120+Giải+Phóng,+Hoàng+Mai,+Hà+Nội&hl=vi&z=16&output=embed',
    lat: 21.008667,
    lng: 105.881001,
  },
  {
    id: '6',
    name: 'True Juice Thanh Xuân',
    address: '250 Trần Duy Hưng, Thanh Xuân, Hà Nội',
    distance: '4.5 km',
    status: 'Đang mở cửa',
    time: '07:00 - 23:00',
    phone: '024 3333 4444',
    image: require('../../assets/images/nen6.png'),
    amenities: ['Wifi miễn phí', 'Chỗ đỗ ô tô', 'Ghế thoải mái'],
    mapEmbedUrl: 'https://maps.google.com/maps?q=250+Trần+Duy+Hưng,+Thanh+Xuân,+Hà+Nội&hl=vi&z=16&output=embed',
    lat: 21.026122,
    lng: 105.793892,
  }
];

const StoreScreen = ({ navigation, route }) => {
  // Mock fallback cho Theme Context nếu bạn chưa cấu hình hoàn chỉnh
  const { isDarkMode = false, colors = { background: '#FAFAFA', accent: ORANGE_COLOR } } = useAppTheme?.() || {};
  const [selectedStore, setSelectedStore] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(timeSlots[0]);
  const [selectedTableNo, setSelectedTableNo] = useState(null);
  const [reservedMap, setReservedMap] = useState({});
  const [myReservations, setMyReservations] = useState([]);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const ui = {
    containerBg: isDarkMode ? colors.background : '#FAFAFA',
    headerBg: isDarkMode ? 'rgba(20,20,20,0.8)' : '#FFFFFF',
    headerBorder: isDarkMode ? 'rgba(212,175,55,0.15)' : '#F0F0F0',
    headerText: isDarkMode ? '#FFFFFF' : '#000000',
    cardBg: isDarkMode ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
    cardText: isDarkMode ? '#FFFFFF' : '#000000',
    cardSubText: isDarkMode ? '#A9A9A9' : '#666666',
    modalBg: isDarkMode ? 'rgba(20,20,20,0.98)' : '#FFFFFF',
    modalText: isDarkMode ? '#FFFFFF' : '#000000',
    modalSubText: isDarkMode ? '#A9A9A9' : '#444444',
    searchBg: isDarkMode ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
    searchBorder: isDarkMode ? 'rgba(212,175,55,0.18)' : '#E5E7EB',
    searchText: isDarkMode ? '#FFFFFF' : '#111827',
    searchPlaceholder: isDarkMode ? '#A9A9A9' : '#6B7280',
  };

  const filteredStores = mockStores.filter((store) => {
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) return true;
    return (
      store.name.toLowerCase().includes(keyword) ||
      store.address.toLowerCase().includes(keyword)
    );
  });

  const handlePressSearch = () => {
    if (isSearchVisible) {
      if (searchQuery.trim()) {
        setSearchQuery('');
        return;
      }
      setIsSearchVisible(false);
      return;
    }
    setIsSearchVisible(true);
  };

  useEffect(() => {
    const reservationResult = route?.params?.reservationResult;
    if (!reservationResult?.storeId || !reservationResult?.timeSlot || !reservationResult?.tableNo) return;

    const key = `${reservationResult.storeId}-${reservationResult.timeSlot}-${reservationResult.tableNo}`;
    setReservedMap((prev) => ({ ...prev, [key]: true }));
    setMyReservations((prev) => {
      const filtered = prev.filter(
        (r) => !(r.storeId === reservationResult.storeId && r.timeSlot === reservationResult.timeSlot)
      );
      return [
        ...filtered,
        {
          storeId: reservationResult.storeId,
          storeName: reservationResult.storeName,
          tableNo: reservationResult.tableNo,
          timeSlot: reservationResult.timeSlot,
        },
      ];
    });
    setSelectedTimeSlot(reservationResult.timeSlot);
    setSelectedTableNo(reservationResult.tableNo);

    if (route?.params?.reservationResult) {
      navigation.setParams({ reservationResult: null });
    }
  }, [navigation, route?.params?.reservationResult]);

  const openStoreDetail = (store) => {
    setSelectedStore(store);
    setSelectedTimeSlot(timeSlots[0]);
    setSelectedTableNo(null);
    setModalVisible(true);
  };

  const checkTableAvailable = (storeId, slot, tableNo) => {
    const key = `${storeId}-${slot}-${tableNo}`;
    if (reservedMap[key]) return false;
    return isTableAvailable(storeId, slot, tableNo);
  };

  const openMapApp = (lat, lng, name) => {
    try {
      let url;
      if (Platform.OS === 'ios') {
        // iOS: Sử dụng maps:// protocol hoặc https URL
        url = `maps://maps.apple.com/?address=${encodeURIComponent(name)}&ll=${lat},${lng}&q=${encodeURIComponent(name)}`;
      } else {
        // Android: Sử dụng geo: protocol
        url = `geo:${lat},${lng}?q=${encodeURIComponent(name)}`;
      }
      
      Linking.openURL(url).catch(err => {
        console.warn('Không thể mở ứng dụng bản đồ, chuyển sang web...', err);
        // Fallback: Mở Google Maps trên web
        const webUrl = `https://maps.google.com/maps?q=${lat},${lng}&z=17`;
        Linking.openURL(webUrl).catch(webErr => {
          console.error('Lỗi khi mở Google Maps web:', webErr);
        });
      });
    } catch (error) {
      console.error('Lỗi:', error);
    }
  };

  const handleReserveTable = (store) => {
    if (!store) return;

    if (store.status !== 'Đang mở cửa') {
      Alert.alert('Chi nhánh tạm đóng', `${store.name} hiện đang đóng cửa. Vui lòng chọn chi nhánh khác.`);
      return;
    }

    if (!selectedTableNo) {
      Alert.alert('Chưa chọn bàn', 'Vui lòng chọn khung giờ và bàn trống trước khi đặt.');
      return;
    }

    const available = checkTableAvailable(store.id, selectedTimeSlot, selectedTableNo);
    if (!available) {
      Alert.alert('Bàn đã hết', `Bàn ${selectedTableNo} ở khung giờ ${selectedTimeSlot} đã được đặt.`);
      return;
    }

    Alert.alert(
      'Đặt bàn trước',
      `Bạn chọn bàn ${selectedTableNo} vào khung giờ ${selectedTimeSlot}.\nChi phí cọc bàn là ${DEPOSIT_AMOUNT.toLocaleString('vi-VN')} đồng tại ${store.name}.`,
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Thanh toán VNPAY',
          onPress: () => {
            setModalVisible(false); // Ẩn Modal đi trước khi chuyển trang
            
            const now = new Date();
            const hh = String(now.getHours()).padStart(2, '0');
            const mm = String(now.getMinutes()).padStart(2, '0');
            const dd = String(now.getDate()).padStart(2, '0');
            const mo = String(now.getMonth() + 1).padStart(2, '0');
            const yyyy = now.getFullYear();
            const reservationCode = `TB-${now.getTime().toString().slice(-6)}`;

            const newOrder = {
              id: reservationCode,
              date: `${hh}:${mm} • ${dd}/${mo}/${yyyy}`,
              status: 'preparing',
              type: 'Table Reservation',
              total: `${DEPOSIT_AMOUNT.toLocaleString('vi-VN')} đ`,
              itemCount: 1,
              mainItem: `Đặt bàn ${selectedTableNo} • ${selectedTimeSlot}`,
              payment: 'Đã thanh toán (VNPAY)',
              address: store.address,
              image: store.image,
            };

            navigation.push('VNPayScreen', {
              amount: DEPOSIT_AMOUNT,
              orderInfo: `Dat coc ban ${selectedTableNo} ${selectedTimeSlot} - ${store.name}`,
              newOrder,
              reservationData: {
                storeId: store.id,
                storeName: store.name,
                tableNo: selectedTableNo,
                timeSlot: selectedTimeSlot,
              },
            });
          },
        },
      ]
    );
  };

  const handleChooseTable = (store, tableNo) => {
    const available = checkTableAvailable(store.id, selectedTimeSlot, tableNo);
    if (!available) {
      Alert.alert('Bàn đã hết', `Bàn ${tableNo} ở khung giờ ${selectedTimeSlot} đã có khách đặt.`);
      return;
    }
    setSelectedTableNo(tableNo);
  };

  const handleCancelReservation = (reservation) => {
    Alert.alert(
      'Huỷ đặt bàn',
      `Bạn có chắc muốn huỷ bàn ${reservation.tableNo} (${reservation.timeSlot}) tại ${reservation.storeName}?`,
      [
        { text: 'Không', style: 'cancel' },
        {
          text: 'Huỷ đặt bàn',
          style: 'destructive',
          onPress: () => {
            const key = `${reservation.storeId}-${reservation.timeSlot}-${reservation.tableNo}`;
            setReservedMap((prev) => {
              const next = { ...prev };
              delete next[key];
              return next;
            });
            setMyReservations((prev) =>
              prev.filter(
                (r) =>
                  !(
                    r.storeId === reservation.storeId &&
                    r.timeSlot === reservation.timeSlot &&
                    r.tableNo === reservation.tableNo
                  )
              )
            );
            if (selectedStore?.id === reservation.storeId && selectedTimeSlot === reservation.timeSlot && selectedTableNo === reservation.tableNo) {
              setSelectedTableNo(null);
            }
            Alert.alert('Đã huỷ', 'Bạn đã huỷ đặt bàn thành công.');
          },
        },
      ]
    );
  };

  const renderStoreCard = ({ item }) => (
    <TouchableOpacity style={[styles.storeCard, { backgroundColor: ui.cardBg }]} onPress={() => openStoreDetail(item)} activeOpacity={0.8}>
      <Image source={typeof item.image === 'string' ? { uri: item.image } : item.image} style={styles.storeImage} />
      <View style={styles.storeInfo}>
        <View style={styles.titleRow}>
          <Text style={[styles.storeName, { color: ui.cardText }]} numberOfLines={1}>{item.name}</Text>
          <Text style={[styles.distanceText, { color: colors.accent || ORANGE_COLOR }]}>{item.distance}</Text>
        </View>
        
        <Text style={[styles.storeAddress, { color: ui.cardSubText }]} numberOfLines={2}>{item.address}</Text>
        
        <View style={styles.bottomRow}>
          <View style={styles.statusBadge}>
            <View style={[styles.statusDot, { backgroundColor: item.status === 'Đang mở cửa' ? '#2ECC71' : '#E74C3C' }]} />
            <Text style={[styles.statusText, { color: item.status === 'Đang mở cửa' ? '#2ECC71' : '#E74C3C' }]}>{item.status}</Text>
          </View>
          <Text style={[styles.detailText, { color: colors.accent || ORANGE_COLOR }]}>Xem chi tiết {'>'}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <SafeAreaView style={[styles.container, { backgroundColor: ui.containerBg }]}> 
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={ui.headerBg} />
      
      {/* HEADER */}
      <View style={[styles.header, { backgroundColor: ui.headerBg, borderBottomColor: ui.headerBorder }]}>
        <Text style={[styles.headerTitle, { color: ui.headerText }]}>Hệ thống cửa hàng</Text>
        <TouchableOpacity style={styles.searchBtn} onPress={handlePressSearch} activeOpacity={0.8}>
          <Feather name={isSearchVisible ? 'x' : 'search'} size={24} color={ui.headerText} />
        </TouchableOpacity>
      </View>

        {isSearchVisible ? (
          <View style={[styles.searchWrap, { backgroundColor: ui.headerBg, borderBottomColor: ui.headerBorder }]}> 
            <View style={[styles.searchInputBox, { backgroundColor: ui.searchBg, borderColor: ui.searchBorder }]}> 
              <Feather name="search" size={18} color={ui.searchPlaceholder} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Tìm theo tên hoặc địa chỉ cửa hàng"
                placeholderTextColor={ui.searchPlaceholder}
                style={[styles.searchInput, { color: ui.searchText }]}
                autoFocus
                returnKeyType="search"
              />
            </View>
          </View>
        ) : null}

      {/* BẢN ĐỒ HIỂN THỊ TẤT CẢ CỬA HÀNG */}
        <View style={styles.mapWrapper}>
          <MapView
            style={{ flex: 1 }}
            initialRegion={{
              latitude: 21.028333,
              longitude: 105.834445,
              latitudeDelta: 0.1,
              longitudeDelta: 0.1,
            }}
          >
            {filteredStores.map((store) => (
              <Marker
                key={store.id}
                coordinate={{
                  latitude: store.lat,
                  longitude: store.lng,
                }}
                title={store.name}
                description={store.address}
                onPress={() => openStoreDetail(store)}
              />
            ))}
          </MapView>
        </View>

      {/* DANH SÁCH CỬA HÀNG */}
        <View style={styles.listWrapper}>
          <Text style={[styles.listTitle, { color: ui.headerText }]}>Cửa hàng gần bạn</Text>
          <FlatList
            data={filteredStores}
            keyExtractor={(item) => item.id}
            renderItem={renderStoreCard}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={true}
            scrollEnabled={true}
            nestedScrollEnabled={true}
            ListEmptyComponent={<Text style={[styles.emptySearchText, { color: ui.cardSubText }]}>Không tìm thấy cửa hàng phù hợp.</Text>}
          />
        </View>

      {/* MODAL CHI TIẾT */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: ui.modalBg }]}>
            {selectedStore && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.dragHandleContainer}>
                  <View style={styles.dragHandle} />
                </View>

                <View style={styles.modalHeader}>
                  <Text style={[styles.modalStoreName, { color: ui.modalText }]}>{selectedStore.name}</Text>
                  <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                    <Ionicons name="close-circle" size={28} color={isDarkMode ? '#555' : '#CCC'} />
                  </TouchableOpacity>
                </View>

                <View style={styles.infoRow}>
                  <Ionicons name="location-outline" size={20} color={colors.accent || ORANGE_COLOR} />
                  <Text style={[styles.infoText, { color: ui.modalSubText }]}>{selectedStore.address}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="time-outline" size={20} color={colors.accent || ORANGE_COLOR} />
                  <Text style={[styles.infoText, { color: ui.modalSubText }]}>Mở cửa: {selectedStore.time}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="call-outline" size={20} color={colors.accent || ORANGE_COLOR} />
                  <Text style={[styles.infoText, { color: ui.modalSubText }]}>{selectedStore.phone}</Text>
                </View>

                {/* Bản đồ tương tác trực tiếp */}
                <View style={styles.mapContainer}>
                  <MapView
                    style={{ flex: 1 }}
                    initialRegion={{
                      latitude: selectedStore.lat,
                      longitude: selectedStore.lng,
                      latitudeDelta: 0.0922,
                      longitudeDelta: 0.0421,
                    }}
                  >
                    <Marker
                      coordinate={{
                        latitude: selectedStore.lat,
                        longitude: selectedStore.lng,
                      }}
                      title={selectedStore.name}
                      description={selectedStore.address}
                    />
                  </MapView>
                </View>

                <Text style={[styles.amenitiesTitle, { color: ui.modalText }]}>Tiện ích cửa hàng</Text>
                <View style={styles.amenitiesContainer}>
                  {selectedStore.amenities.map((item, index) => (
                    <View key={index} style={[styles.amenityBadge, { backgroundColor: isDarkMode ? 'rgba(229, 121, 5, 0.15)' : '#FFF3E0' }]}>
                      <MaterialCommunityIcons name="check-decagram" size={16} color={colors.accent || ORANGE_COLOR} />
                      <Text style={[styles.amenityText, { color: colors.accent || ORANGE_COLOR }]}>{item}</Text>
                    </View>
                  ))}
                </View>

                <Text style={[styles.sectionLabel, { color: ui.modalText }]}>Chọn khung giờ đặt bàn</Text>
                <View style={styles.slotWrap}>
                  {timeSlots.map((slot) => {
                    const active = selectedTimeSlot === slot;
                    return (
                      <TouchableOpacity
                        key={slot}
                        style={[
                          styles.slotChip,
                          {
                            borderColor: colors.accent || ORANGE_COLOR,
                            backgroundColor: active ? colors.accent || ORANGE_COLOR : 'transparent',
                          },
                        ]}
                        onPress={() => {
                          setSelectedTimeSlot(slot);
                          setSelectedTableNo(null);
                        }}
                      >
                        <Text style={[styles.slotText, { color: active ? '#FFFFFF' : colors.accent || ORANGE_COLOR }]}>{slot}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={[styles.sectionLabel, { color: ui.modalText }]}>Sơ đồ bàn (Trống/Hết)</Text>
                <View style={styles.tablesGrid}>
                  {tableNumbers.map((tableNo) => {
                    const available = checkTableAvailable(selectedStore.id, selectedTimeSlot, tableNo);
                    const selected = selectedTableNo === tableNo;

                    return (
                      <TouchableOpacity
                        key={`${selectedStore.id}-${selectedTimeSlot}-${tableNo}`}
                        style={[
                          styles.tableItem,
                          {
                            borderColor: selected
                              ? colors.accent || ORANGE_COLOR
                              : available
                              ? '#2ECC71'
                              : '#E74C3C',
                            backgroundColor: selected
                              ? isDarkMode
                                ? 'rgba(229,121,5,0.22)'
                                : 'rgba(229,121,5,0.12)'
                              : available
                              ? isDarkMode
                                ? 'rgba(46,204,113,0.16)'
                                : 'rgba(46,204,113,0.12)'
                              : isDarkMode
                              ? 'rgba(231,76,60,0.18)'
                              : 'rgba(231,76,60,0.12)',
                          },
                        ]}
                        onPress={() => handleChooseTable(selectedStore, tableNo)}
                      >
                        <Text style={[styles.tableName, { color: ui.modalText }]}>Bàn {tableNo}</Text>
                        <Text style={[styles.tableStatus, { color: available ? '#2ECC71' : '#E74C3C' }]}>
                          {available ? 'Trống' : 'Hết'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {selectedTableNo ? (
                  <Text style={[styles.selectedTableNote, { color: colors.accent || ORANGE_COLOR }]}>Bạn đang chọn: Bàn {selectedTableNo} • {selectedTimeSlot}</Text>
                ) : null}

                <Text style={[styles.sectionLabel, { color: ui.modalText }]}>Bàn bạn đã đặt</Text>
                {myReservations.filter((r) => r.storeId === selectedStore.id).length > 0 ? (
                  myReservations
                    .filter((r) => r.storeId === selectedStore.id)
                    .map((r) => (
                      <View key={`${r.storeId}-${r.timeSlot}-${r.tableNo}`} style={[styles.reservationItem, { borderColor: ui.headerBorder }]}>
                        <View style={styles.reservationInfoRow}>
                          <MaterialCommunityIcons name="calendar-check" size={18} color={colors.accent || ORANGE_COLOR} />
                          <Text style={[styles.reservationItemText, { color: ui.modalText }]}>Bàn {r.tableNo} • {r.timeSlot}</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.cancelReservationBtn}
                          onPress={() => handleCancelReservation(r)}
                        >
                          <Text style={styles.cancelReservationText}>Huỷ</Text>
                        </TouchableOpacity>
                      </View>
                    ))
                ) : (
                  <Text style={[styles.emptyReservationText, { color: ui.modalSubText }]}>Bạn chưa đặt bàn ở chi nhánh này.</Text>
                )}

                <TouchableOpacity 
                  style={[styles.reserveBtn, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#111827', borderColor: colors.accent || ORANGE_COLOR }]}
                  onPress={() => handleReserveTable(selectedStore)}
                >
                  <MaterialCommunityIcons name="table-chair" size={22} color={colors.accent || ORANGE_COLOR} />
                  <Text style={[styles.reserveBtnText, { color: '#FFFFFF' }]}>Đặt bàn trước (Cọc {DEPOSIT_AMOUNT.toLocaleString('vi-VN')}đ)</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.directionBtn, { backgroundColor: colors.accent || ORANGE_COLOR }]}
                  onPress={() => openMapApp(selectedStore.lat, selectedStore.lng, selectedStore.name)}
                >
                  <Ionicons name="navigate-circle-outline" size={24} color="#FFF" />
                  <Text style={styles.directionBtnText}>Chỉ đường đến đây</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 22, fontWeight: 'bold' },
  searchBtn: { padding: 5 },
  searchWrap: {
    paddingHorizontal: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  searchInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    paddingVertical: 0,
  },
  mapWrapper: {
    height: 300,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  listWrapper: {
    flex: 1,
    paddingHorizontal: 15,
    paddingTop: 10,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  listContent: { paddingBottom: 20 },
  emptySearchText: {
    textAlign: 'center',
    fontSize: 14,
    marginTop: 20,
    fontStyle: 'italic',
  },
  storeCard: {
    borderRadius: 16,
    padding: 15,
    marginBottom: 15,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  storeImage: { width: 80, height: 80, borderRadius: 12, marginRight: 15 },
  storeInfo: { flex: 1, justifyContent: 'space-between' },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  storeName: { fontSize: 16, fontWeight: 'bold', flex: 1 },
  distanceText: { fontSize: 12, fontWeight: 'bold' },
  storeAddress: { fontSize: 13, marginVertical: 4, lineHeight: 18 },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusBadge: { flexDirection: 'row', alignItems: 'center' },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 5 },
  statusText: { fontSize: 12, fontWeight: '600' },
  detailText: { fontSize: 12, fontWeight: '500' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 30,
    maxHeight: '90%',
  },
  dragHandleContainer: { alignItems: 'center', paddingVertical: 10 },
  dragHandle: { width: 40, height: 5, backgroundColor: '#DDD', borderRadius: 3 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  modalStoreName: { fontSize: 20, fontWeight: 'bold', flex: 1 },
  closeBtn: { padding: 5 },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  infoText: { fontSize: 14, marginLeft: 10, flex: 1 },
  mapContainer: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    overflow: 'hidden',
    marginVertical: 15,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#F5F5F5',
  },
  amenitiesTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 10 },
  amenitiesContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20 },
  amenityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 10,
    marginBottom: 10,
  },
  amenityText: { fontSize: 12, marginLeft: 5, fontWeight: '500' },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  slotWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 14,
  },
  slotChip: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  slotText: {
    fontSize: 13,
    fontWeight: '700',
  },
  tablesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  tableItem: {
    width: '31.5%',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    marginBottom: 10,
    alignItems: 'center',
  },
  tableName: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  tableStatus: {
    fontSize: 12,
    fontWeight: '700',
  },
  selectedTableNote: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
  },
  reservationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  reservationInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  reservationItemText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
  },
  cancelReservationBtn: {
    backgroundColor: 'rgba(231,76,60,0.12)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginLeft: 10,
  },
  cancelReservationText: {
    color: '#E74C3C',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyReservationText: {
    fontSize: 13,
    marginBottom: 10,
  },
  directionBtn: {
    flexDirection: 'row',
    paddingVertical: 15,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reserveBtn: {
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
  },
  reserveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 8,
  },
  directionBtnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
});

export default StoreScreen;