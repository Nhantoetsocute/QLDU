import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Keyboard,
  StyleSheet,
  ImageBackground,
  Dimensions,
  Animated,
  StatusBar,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../theme/ThemeContext';
import { useUserProfile } from '../context/UserProfileContext';
import { apiUrl } from '../config/api';

const { width, height } = Dimensions.get('window');

const Petal = ({ delay, startX }) => {
  const translateY = useRef(new Animated.Value(-50)).current;
  const translateX = useRef(new Animated.Value(startX)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: height + 50,
          duration: 6000 + Math.random() * 4000,
          delay: delay,
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: startX + (Math.random() * 100 - 50),
          duration: 6000 + Math.random() * 4000,
          delay: delay,
          useNativeDriver: true,
        }),
        Animated.timing(rotate, {
          toValue: 1,
          duration: 4000 + Math.random() * 2000,
          delay: delay,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [delay, startX]);

  const spin = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        transform: [{ translateY }, { translateX }, { rotate: spin }],
      }}
    >
      <Text style={{ fontSize: 14 + Math.random() * 8, color: '#FFB7C5', opacity: 0.8 }}>🌸</Text>
    </Animated.View>
  );
};

const FallingBlossoms = React.memo(() => {
  const petals = Array.from({ length: 20 }).map((_, i) => (
    <Petal key={i} delay={Math.random() * 5000} startX={Math.random() * width} />
  ));
  return <View style={StyleSheet.absoluteFillObject} pointerEvents="none">{petals}</View>;
});

const LoginScreen = ({ navigation }) => {
  const { isDarkMode, colors } = useAppTheme();
  const { loginContext } = useUserProfile();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert("Lỗi", "Vui lòng nhập Email và Mật khẩu!");
      return;
    }

    setIsLoading(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 giây timeout

    try {
      const API_URL = apiUrl('/api/auth/login');
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: username, password: password }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      const data = await response.json();
      
      if (response.ok) {
        await loginContext(data.token, data.user);
        navigation?.replace('MainTabs');
      } else {
        Alert.alert("Từ chối!", data.error || "Sai tài khoản hoặc mật khẩu");
      }
    } catch (error) {
      if (error?.name === 'AbortError' || error?.message === 'Aborted') {
        Alert.alert("Lỗi Mạng", "Yêu cầu quá hạn. Máy chủ không phản hồi!");
      } else {
        console.error(error);
        Alert.alert("Lỗi Mạng", "Không kết nối được máy chủ Backend!");
      }
    } finally {
      clearTimeout(timeoutId);
      setIsLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
        <ImageBackground
          source={require('../../assets/images/tra_cam_xa.jpg')}
          style={styles.backgroundImage}
        >
          <View style={[styles.overlay, { backgroundColor: colors.overlay }]} />
          <FallingBlossoms />
          <View style={styles.contentContainer}>
            <View style={styles.headerContainer}>
              <Text style={styles.brandName}>True Juice</Text>
              <Text style={styles.subtitle}>Thưởng thức sự tinh tế</Text>
            </View>
            <View style={styles.glassForm}>
              <Text style={styles.formTitle}>Đăng Nhập</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="person-outline" size={20} color="#D4AF37" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Tên đăng nhập hoặc Email"
                  placeholderTextColor="#A9A9A9"
                  value={username}
                  onChangeText={setUsername}
                  editable={!isLoading}
                />
              </View>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={20} color="#D4AF37" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Mật khẩu"
                  placeholderTextColor="#A9A9A9"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                  editable={!isLoading}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} disabled={isLoading}>
                  <Ionicons
                    name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color="#D4AF37"
                  />
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.forgotPassword} onPress={() => navigation?.navigate('ForgotPassword')} disabled={isLoading}>
                <Text style={styles.forgotPasswordText}>Quên mật khẩu?</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.loginButton, isLoading && { opacity: 0.7 }]} 
                onPress={handleLogin}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Text style={styles.loginButtonText}>ĐANG XỬ LÝ...</Text>
                ) : (
                  <Text style={styles.loginButtonText}>BẮT ĐẦU HÀNH TRÌNH</Text>
                )}
              </TouchableOpacity>
            </View>
            <View style={styles.signupContainer}>
              <Text style={styles.signupText}>Chưa có thẻ thành viên? </Text>
              <TouchableOpacity onPress={() => navigation?.navigate('SignUp')} disabled={isLoading}>
                <Text style={styles.signupLink}>Tạo ngay</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ImageBackground>
      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  backgroundImage: { flex: 1, resizeMode: 'cover' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10, 10, 10, 0.65)' },
  contentContainer: { flex: 1, justifyContent: 'center', paddingHorizontal: 25 },
  headerContainer: { alignItems: 'center', marginBottom: 40 },
  brandName: { fontSize: 36, fontWeight: '800', color: '#D4AF37', letterSpacing: 3, textShadowColor: 'rgba(212, 175, 55, 0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 10 },
  subtitle: { fontSize: 16, color: '#FFF', fontStyle: 'italic', marginTop: 5, letterSpacing: 1, opacity: 0.8 },
  glassForm: { backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: 20, padding: 25, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.2)', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 5 },
  formTitle: { fontSize: 24, fontWeight: 'bold', color: '#FFF', marginBottom: 25, textAlign: 'center' },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.3)', borderRadius: 12, marginBottom: 15, paddingHorizontal: 15, height: 55, borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.3)' },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 16, color: '#FFF' },
  forgotPassword: { alignSelf: 'flex-end', marginBottom: 25 },
  forgotPasswordText: { color: '#D4AF37', fontSize: 14, fontWeight: '500' },
  loginButton: { backgroundColor: '#D4AF37', borderRadius: 12, height: 55, justifyContent: 'center', alignItems: 'center', shadowColor: '#D4AF37', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 5 },
  loginButtonText: { color: '#1A1A1A', fontSize: 16, fontWeight: 'bold', letterSpacing: 1 },
  signupContainer: { flexDirection: 'row', justifyContent: 'center', marginTop: 30 },
  signupText: { color: '#FFF', fontSize: 15 },
  signupLink: { color: '#D4AF37', fontSize: 15, fontWeight: 'bold' }
});

export default LoginScreen;