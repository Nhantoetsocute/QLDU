import React from 'react';
import { View, Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

// Import màn hình Trang chủ bạn vừa tạo
import HomeScreen from '../screens/HomeScreen';

// Tạo một màn hình Tạm (Dummy Screen) cho các tab chưa code đến
const PlaceholderScreen = ({ route }) => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <Text style={{ fontSize: 18, color: '#666' }}>Đây là trang {route.name}</Text>
  </View>
);

const Tab = createBottomTabNavigator();

const MainTabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false, // Ẩn header mặc định của Tab
        tabBarActiveTintColor: '#E57905', // Màu cam khi tab được chọn (Active)
        tabBarInactiveTintColor: '#888',  // Màu xám khi tab không được chọn
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#F0F0F0',
          height: 65,
          paddingBottom: 10,
          paddingTop: 5,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        // Cấu hình Icon cho từng Tab
        tabBarIcon: ({ focused, color, size }) => {
          size = 24; // Kích thước icon chuẩn

          if (route.name === 'Trang Chủ') {
            return <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} />;
          } 
          else if (route.name === 'Đặt Hàng') {
            return <MaterialCommunityIcons name={focused ? 'coffee' : 'coffee-outline'} size={size} color={color} />;
          } 
          else if (route.name === 'Cửa Hàng') {
            return <Ionicons name={focused ? 'storefront' : 'storefront-outline'} size={size} color={color} />;
          } 
          else if (route.name === 'Ưu Đãi') {
            return <MaterialCommunityIcons name={focused ? 'ticket-percent' : 'ticket-percent-outline'} size={size} color={color} />;
          } 
          else if (route.name === 'Khác') {
            return <Ionicons name={focused ? 'menu' : 'menu-outline'} size={size} color={color} />;
          }
        },
      })}
    >
      {/* Khai báo các trang tương ứng với các nút dưới Tab */}
      <Tab.Screen name="Trang Chủ" component={HomeScreen} />
      <Tab.Screen name="Đặt Hàng" component={PlaceholderScreen} />
      <Tab.Screen name="Cửa Hàng" component={PlaceholderScreen} />
      <Tab.Screen name="Ưu Đãi" component={PlaceholderScreen} />
      <Tab.Screen name="Khác" component={PlaceholderScreen} />
    </Tab.Navigator>
  );
};

export default MainTabNavigator;