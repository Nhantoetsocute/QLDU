import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../theme/ThemeContext';

import HomeScreen from '../screens/HomeScreen';
import OrderHistoryScreen from '../screens/OrderHistoryScreen';
import MenuScreen from '../screens/MenuScreen';
import StoreScreen from '../screens/StoreScreen';
import OffersScreen from '../screens/OffersScreen';

// Cập nhật PlaceholderScreen với nền tối để đồng bộ giao diện
const PlaceholderScreen = ({ route }) => {
  const { colors } = useAppTheme();

  return (
    <View style={[styles.placeholderContainer, { backgroundColor: colors.background }]}>
      <Ionicons name="construct-outline" size={50} color={colors.accent} style={{ opacity: 0.5, marginBottom: 15 }} />
      <Text style={[styles.placeholderText, { color: colors.accent }]}>Trang {route.name} đang xây dựng...</Text>
      <Text style={[styles.placeholderSub, { color: colors.subText }]}>Vui lòng quay lại sau nhé!</Text>
    </View>
  );
};

const Tab = createBottomTabNavigator();

// --- NÚT ĐẶT HÀNG TRUNG TÂM (FLOATING ACTION BUTTON) ---
const CustomOrderButton = ({ children, onPress, colors, isDarkMode }) => (
  <TouchableOpacity
    style={styles.customButtonWrapper}
    onPress={onPress}
    activeOpacity={0.8}
  >
    <View
      style={[
        styles.customButtonInner,
        {
          backgroundColor: colors.accent,
          borderColor: isDarkMode ? colors.tabBarBackground : '#FFFFFF',
        },
      ]}
    >
      {children}
    </View>
  </TouchableOpacity>
);

const MainTabNavigator = () => {
  const { colors, isDarkMode } = useAppTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true, // Giữ nhãn nhưng sẽ làm cho nó tinh tế hơn
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.tabBarInactive,
        tabBarStyle: [
          styles.floatingTabBar,
          {
            backgroundColor: colors.tabBarBackground,
            borderTopColor: colors.border,
            shadowColor: colors.accent,
          },
        ],
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ focused, color, size }) => {
          size = 22; // Thu nhỏ icon một chút để tinh tế hơn
          let iconName;

          if (route.name === 'Trang Chủ') {
            iconName = focused ? 'home' : 'home-outline';
            return <Ionicons name={iconName} size={size} color={color} style={focused ? styles.glowIcon : null} />;
          } 
          else if (route.name === 'Đặt Hàng') {
            // Nút giữa dùng icon màu đen trên nền Vàng Gold
            return <MaterialCommunityIcons name="coffee-outline" size={28} color={isDarkMode ? '#1A1A1A' : '#FFFFFF'} />;
          } 
          else if (route.name === 'Cửa Hàng') {
            iconName = focused ? 'storefront' : 'storefront-outline';
            return <Ionicons name={iconName} size={size} color={color} style={focused ? styles.glowIcon : null} />;
          } 
          else if (route.name === 'Ưu Đãi') {
            iconName = focused ? 'ticket-percent' : 'ticket-percent-outline';
            return <MaterialCommunityIcons name={iconName} size={size} color={color} style={focused ? styles.glowIcon : null} />;
          } 
          else if (route.name === 'Khác') {
            iconName = focused ? 'menu' : 'menu-outline';
            return <Ionicons name={iconName} size={size} color={color} style={focused ? styles.glowIcon : null} />;
          }
        },
      })}
    >
      <Tab.Screen name="Trang Chủ" component={HomeScreen} />
      <Tab.Screen name="Cửa Hàng" component={StoreScreen} />
      
      {/* NÚT ĐẶT HÀNG Ở GIỮA */}
      <Tab.Screen 
        name="Đặt Hàng" 
        component={OrderHistoryScreen} 
        options={{
          tabBarLabel: () => null, // Ẩn chữ "Đặt Hàng" vì nút này đã quá nổi bật
          tabBarButton: (props) => (
            <CustomOrderButton {...props} colors={colors} isDarkMode={isDarkMode} />
          ),
        }}
      />
      
      <Tab.Screen name="Ưu Đãi" component={OffersScreen} />
      <Tab.Screen name="Khác" component={MenuScreen} />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  placeholderContainer: {
    flex: 1, 
    backgroundColor: '#0A0A0A', // Màu nền tối
    justifyContent: 'center', 
    alignItems: 'center',
    padding: 20,
  },
  placeholderText: {
    fontSize: 20, 
    fontWeight: 'bold',
    color: '#D4AF37',
    marginBottom: 8,
    textShadowColor: 'rgba(212, 175, 55, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 5,
  },
  placeholderSub: {
    fontSize: 14,
    color: '#888',
  },
  floatingTabBar: {
    position: 'absolute', // Vẫn giữ absolute để đè lên nội dung ScrollView
    bottom: 0,            // Sát đáy màn hình
    left: 0,              // Kéo dài hết chiều ngang
    right: 0,             // Kéo dài hết chiều ngang
    elevation: 10,
    backgroundColor: '#0A0A0A', // màu thực tế được override bởi theme
    height: Platform.OS === 'ios' ? 90 : 70, // Cao hơn một chút để đẹp trên iPhone có tai thỏ
    borderTopWidth: 1,
    borderTopColor: 'rgba(212, 175, 55, 0.3)', // sẽ được override bởi theme
    shadowColor: '#D4AF37', // sẽ được override bởi theme
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    paddingBottom: Platform.OS === 'ios' ? 25 : 10, // Padding để icon không chạm đáy máy
  },

  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: -5,
    marginBottom: 5,
  },

  glowIcon: {
    textShadowColor: 'rgba(212, 175, 55, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },

  // --- Nút Trung Tâm (Đặt Hàng) - Vẫn để lồi lên cho lộng lẫy ---
  customButtonWrapper: {
    top: -30, // Đẩy nút lồi lên trên viền thanh tab
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  customButtonInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#D4AF37',
    borderWidth: 5,
    borderColor: '#0A0A0A', // Viền đen dày để tạo hiệu ứng tách biệt với thanh tab
    justifyContent: 'center',
    alignItems: 'center',
  },
});
export default MainTabNavigator;