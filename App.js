import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LoginScreen from './src/screens/LoginScreen';
import SignUpScreen from './src/screens/SignUpScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import AllProductsScreen from './src/screens/AllProductsScreen';
import ProductDetailScreen from './src/screens/ProductDetailScreen';
import OrderTrackingScreen from './src/screens/OrderTrackingScreen';
import MenuScreen from './src/screens/MenuScreen';
import CartScreen from './src/screens/CartScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import OffersScreen from './src/screens/OffersScreen';
import VNPayScreen from './src/screens/VNPayScreen';
import CheckoutScreen from './src/screens/CheckoutScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import LanguageScreen from './src/screens/LanguageScreen';
import PrivacyScreen from './src/screens/PrivacyScreen';
import HelpCenterScreen from './src/screens/HelpCenterScreen';
import TermsScreen from './src/screens/TermsScreen';
import { ThemeProvider, useAppTheme } from './src/theme/ThemeContext';
import { UserProfileProvider } from './src/context/UserProfileContext';
import { CartProvider } from './src/context/CartContext';
// Đưa MainTabNavigator vào
import MainTabNavigator from './src/navigation/MainTabNavigator'; 

const Stack = createNativeStackNavigator();

const AppNavigator = () => {
  const { navigationTheme } = useAppTheme();

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {/* Các màn hình liên quan đến Đăng nhập/Đăng ký KHÔNG có thanh Tab ở dưới */}
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="SignUp" component={SignUpScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        <Stack.Screen name="AllProducts" component={AllProductsScreen} />
        <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
        <Stack.Screen name="Cart" component={CartScreen} />
        <Stack.Screen name="OrderTracking" component={OrderTrackingScreen} />
        <Stack.Screen name="Menu" component={MenuScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="Offers" component={OffersScreen} />
        <Stack.Screen name="VNPayScreen" component={VNPayScreen} />
        <Stack.Screen name="Checkout" component={CheckoutScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="Language" component={LanguageScreen} />
        <Stack.Screen name="Privacy" component={PrivacyScreen} />
        <Stack.Screen name="HelpCenter" component={HelpCenterScreen} />
        <Stack.Screen name="Terms" component={TermsScreen} />
        {/* Sau khi đăng nhập thành công, chuyển hướng vào MainTabs -> Sẽ thấy thanh Bottom Bar */}
        <Stack.Screen name="MainTabs" component={MainTabNavigator} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <UserProfileProvider>
        <CartProvider>
          <AppNavigator />
        </CartProvider>
      </UserProfileProvider>
    </ThemeProvider>
  );
}