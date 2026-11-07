import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';

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
import ChatScreen from './src/screens/ChatScreen';
import FloatingChatButton from './src/components/FloatingChatButton';
import { ThemeProvider, useAppTheme } from './src/theme/ThemeContext';
import { UserProfileProvider, useUserProfile } from './src/context/UserProfileContext';
import { CartProvider } from './src/context/CartContext';
// Đưa MainTabNavigator vào
import MainTabNavigator from './src/navigation/MainTabNavigator'; 

const Stack = createNativeStackNavigator();
const HIDDEN_CHAT_ROUTES = new Set(['Chat', 'Login', 'SignUp', 'ForgotPassword']);

const AppNavigator = () => {
  const { navigationTheme } = useAppTheme();
  const { token, isLoading } = useUserProfile();
  const navigationRef = useNavigationContainerRef();
  const [currentRoute, setCurrentRoute] = useState('Login');
  const updateCurrentRoute = () => setCurrentRoute(navigationRef.getCurrentRoute()?.name || 'Login');

  if (isLoading) return <View style={{flex:1,justifyContent:'center',alignItems:'center'}}><ActivityIndicator accessibilityLabel="Đang xác thực phiên" /></View>;

  return (
    <NavigationContainer ref={navigationRef} theme={navigationTheme} onReady={updateCurrentRoute} onStateChange={updateCurrentRoute}>
      <View style={styles.navigationRoot}>
      <Stack.Navigator key={token ? 'signed-in' : 'signed-out'} initialRouteName={token ? 'MainTabs' : 'Login'} screenOptions={{ headerShown: false }}>
        {token ? (<>
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
        <Stack.Screen name="HelpCenter" component={HelpCenterScreen} />
        <Stack.Screen name="Chat" component={ChatScreen} />
        {/* Sau khi đăng nhập thành công, chuyển hướng vào MainTabs -> Sẽ thấy thanh Bottom Bar */}
        <Stack.Screen name="MainTabs" component={MainTabNavigator} />
        </>) : (<>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="SignUp" component={SignUpScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        </>)}
        <Stack.Screen name="Privacy" component={PrivacyScreen} />
        <Stack.Screen name="Terms" component={TermsScreen} />
      </Stack.Navigator>
      {!!token && (
        <FloatingChatButton visible={!HIDDEN_CHAT_ROUTES.has(currentRoute)} onPress={() => {
          if (navigationRef.isReady()) navigationRef.navigate('Chat');
        }} />
      )}
      </View>
    </NavigationContainer>
  );
};

export default function App() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
    <ThemeProvider>
      <UserProfileProvider>
        <CartProvider>
          <AppNavigator />
        </CartProvider>
      </UserProfileProvider>
    </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({ navigationRoot: { flex: 1 } });
