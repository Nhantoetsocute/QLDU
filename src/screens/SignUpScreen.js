import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ImageBackground,
  Dimensions,
  Animated,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Easing,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../theme/ThemeContext';

const { width, height } = Dimensions.get('window');

// --- COMPONENT: BỤI VÀNG TRÔI NỔI (GOLD DUST) ---
const Particle = ({ delay, startX, size }) => {
  const translateY = useRef(new Animated.Value(height)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Hiệu ứng bay lên
    Animated.loop(
      Animated.timing(translateY, {
        toValue: -100,
        duration: 8000 + Math.random() * 5000,
        delay: delay,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Hiệu ứng lấp lánh (Fade in/out)
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.6 + Math.random() * 0.4,
          duration: 1000 + Math.random() * 2000,
          delay: delay,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 1000 + Math.random() * 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [delay]);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: startX,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#D4AF37', // Vàng Gold
        shadowColor: '#D4AF37',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 5,
        elevation: 5,
        transform: [{ translateY }],
        opacity: opacity,
      }}
    />
  );
};

const FloatingGoldDust = () => {
  // Tạo 30 hạt bụi vàng kích thước và vị trí ngẫu nhiên
  const particles = Array.from({ length: 30 }).map((_, i) => (
    <Particle 
      key={i} 
      delay={Math.random() * 8000} 
      startX={Math.random() * width} 
      size={2 + Math.random() * 4} 
    />
  ));
  return <View style={StyleSheet.absoluteFillObject} pointerEvents="none">{particles}</View>;
};

// --- MÀN HÌNH CHÍNH: ĐĂNG KÝ ---
const SignUpScreen = ({ navigation }) => {
  const { isDarkMode, colors } = useAppTheme();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }] }>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
      
      {/* Nền ảnh cao cấp */}
      <ImageBackground
        source={{ uri: 'https://images.unsplash.com/photo-1497935586351-b67a49e012bf?q=80&w=800&auto=format&fit=crop' }}
        style={styles.backgroundImage}
      >
        <View style={[styles.overlay, { backgroundColor: colors.overlay }]} />
        
        {/* Hiệu ứng hạt bụi vàng */}
        <FloatingGoldDust />

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Nút Back */}
            <TouchableOpacity style={styles.backButton} onPress={() => navigation?.goBack()}>
              <Ionicons name="chevron-back" size={32} color="#D4AF37" />
            </TouchableOpacity>

            <View style={styles.headerContainer}>
              <Text style={styles.title}>TRỞ THÀNH{'\n'}THÀNH VIÊN</Text>
              <Text style={styles.subtitle}>Mở khóa những đặc quyền thượng lưu cùng True Juice.</Text>
            </View>

            {/* Form Kính Mờ */}
            <View style={styles.glassForm}>
              {/* Họ và tên */}
              <View style={styles.inputWrapper}>
                <Ionicons name="person-outline" size={20} color="#D4AF37" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Họ và tên của bạn"
                  placeholderTextColor="#A9A9A9"
                  value={fullName}
                  onChangeText={setFullName}
                />
              </View>

              {/* Số điện thoại */}
              <View style={styles.inputWrapper}>
                <Ionicons name="call-outline" size={20} color="#D4AF37" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Số điện thoại"
                  placeholderTextColor="#A9A9A9"
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                />
              </View>

              {/* Email */}
              <View style={styles.inputWrapper}>
                <MaterialCommunityIcons name="email-outline" size={20} color="#D4AF37" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Địa chỉ Email"
                  placeholderTextColor="#A9A9A9"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>

              {/* Mật khẩu */}
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={20} color="#D4AF37" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Mật khẩu bảo mật"
                  placeholderTextColor="#A9A9A9"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons
                    name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color="#D4AF37"
                  />
                </TouchableOpacity>
              </View>

              {/* Nút Đăng ký */}
              <TouchableOpacity style={styles.submitButton}>
                <Text style={styles.submitButtonText}>MỞ KHÓA ĐẶC QUYỀN</Text>
              </TouchableOpacity>
            </View>

            {/* Điều hướng về Đăng nhập */}
            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>Đã sở hữu thẻ thành viên? </Text>
              <TouchableOpacity onPress={() => navigation?.navigate('Login')}>
                <Text style={styles.loginLink}>Đăng nhập</Text>
              </TouchableOpacity>
            </View>

          </ScrollView>
        </KeyboardAvoidingView>
      </ImageBackground>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
    resizeMode: 'cover',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 15, 15, 0.75)', // Nền tối làm nổi bật màu gold
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 25,
    paddingTop: 50,
    paddingBottom: 40,
  },
  backButton: {
    marginTop: 10,
    marginBottom: 20,
    marginLeft: -10,
    width: 40,
  },
  headerContainer: {
    marginBottom: 35,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#D4AF37', // Vàng Gold
    letterSpacing: 2,
    lineHeight: 40,
    textShadowColor: 'rgba(212, 175, 55, 0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#E0E0E0',
    marginTop: 10,
    lineHeight: 22,
    opacity: 0.9,
  },
  glassForm: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    padding: 25,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)', // Viền vàng mờ
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 5,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 12,
    marginBottom: 18,
    paddingHorizontal: 15,
    height: 55,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)', 
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#FFF',
  },
  submitButton: {
    backgroundColor: '#D4AF37',
    borderRadius: 12,
    height: 55,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 15,
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 5,
  },
  submitButtonText: {
    color: '#1A1A1A',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1.5,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 40,
  },
  loginText: {
    color: '#E0E0E0',
    fontSize: 15,
  },
  loginLink: {
    color: '#D4AF37',
    fontSize: 15,
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
});

export default SignUpScreen;