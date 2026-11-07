import BackgroundImage from '../components/BackgroundImage';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Keyboard,
  StyleSheet,
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
  return <View style={StyleSheet.absoluteFill} pointerEvents="none">{petals}</View>;
});

const LoginScreen = ({ navigation }) => {
  const { isDarkMode, colors } = useAppTheme();
  const { loginContext } = useUserProfile();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockDuration, setLockDuration] = useState(30);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [loginFeedback, setLoginFeedback] = useState('');

  useEffect(() => {
    if (!cooldownUntil) {
      setRemainingSeconds(0);
      return undefined;
    }
    const update = () => {
      const remaining = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
      setRemainingSeconds(remaining);
      if (!remaining) setCooldownUntil(0);
    };
    update();
    const interval = setInterval(update, 500);
    return () => clearInterval(interval);
  }, [cooldownUntil]);

  const handleLogin = async () => {
    if (remainingSeconds > 0) return;
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
        setFailedAttempts(0);
        setLockDuration(30);
        setCooldownUntil(0);
        setLoginFeedback('');
        await loginContext(data.token, data.user);
        // Authenticated navigation is mounted by AppNavigator after session validation.
      } else {
        if (response.status === 401) {
          const nextAttempt = failedAttempts + 1;
          if (nextAttempt >= 4) {
            const duration = nextAttempt === 4 ? lockDuration : lockDuration + 30;
            setFailedAttempts(4);
            setLockDuration(duration);
            setCooldownUntil(Date.now() + duration * 1000);
            setLoginFeedback(`Thông tin đăng nhập không hợp lệ hoặc có thể đang bị tạm khóa. Vui lòng thử lại sau ${duration} giây hoặc khôi phục mật khẩu.`);
          } else {
            setFailedAttempts(nextAttempt);
            setLoginFeedback(nextAttempt === 3
              ? 'Thông tin đăng nhập không hợp lệ. Lần thử sai tiếp theo có thể tạm khóa đăng nhập. Nếu quên mật khẩu, hãy dùng “Quên mật khẩu?”.'
              : 'Thông tin đăng nhập không hợp lệ. Kiểm tra email và mật khẩu hoặc dùng “Quên mật khẩu?”.');
          }
        } else if (response.status === 429) {
          const retryAfter = Math.max(1, Number(response.headers.get('Retry-After')) || 30);
          setCooldownUntil(Date.now() + retryAfter * 1000);
          setLoginFeedback(`Yêu cầu đăng nhập đang bị giới hạn. Vui lòng thử lại sau ${retryAfter} giây.`);
        } else {
          setLoginFeedback(data.error || 'Không thể đăng nhập. Vui lòng thử lại.');
        }
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
        <BackgroundImage
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
                  onChangeText={(value) => {
                    if (value.trim().toLowerCase() !== username.trim().toLowerCase()) {
                      setFailedAttempts(0);
                      setLockDuration(30);
                      setCooldownUntil(0);
                    }
                    setUsername(value);
                    setLoginFeedback('');
                  }}
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
                  onChangeText={(value) => { setPassword(value); setLoginFeedback(''); }}
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
              {!!loginFeedback && <Text accessibilityLiveRegion="polite" style={styles.loginFeedback}>{loginFeedback}</Text>}
              <TouchableOpacity 
                style={[styles.loginButton, (isLoading || remainingSeconds > 0) && { opacity: 0.7 }]}
                onPress={handleLogin}
                disabled={isLoading || remainingSeconds > 0}
              >
                {remainingSeconds > 0 ? (
                  <Text style={styles.loginButtonText}>THỬ LẠI SAU {remainingSeconds}s</Text>
                ) : isLoading ? (
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
        </BackgroundImage>
      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  backgroundImage: { flex: 1, resizeMode: 'cover' },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(10, 10, 10, 0.65)' },
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
  loginFeedback: { color: '#FFD98A', fontSize: 13, lineHeight: 19, marginBottom: 12 },
  loginButton: { backgroundColor: '#D4AF37', borderRadius: 12, height: 55, justifyContent: 'center', alignItems: 'center', shadowColor: '#D4AF37', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 5 },
  loginButtonText: { color: '#1A1A1A', fontSize: 16, fontWeight: 'bold', letterSpacing: 1 },
  signupContainer: { flexDirection: 'row', justifyContent: 'center', marginTop: 30 },
  signupText: { color: '#FFF', fontSize: 15 },
  signupLink: { color: '#D4AF37', fontSize: 15, fontWeight: 'bold' }
});

export default LoginScreen;