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
} from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useAppTheme } from '../theme/ThemeContext';

const { width, height } = Dimensions.get('window');

// --- COMPONENT: CÁNH HOA ĐÀO RƠI ---
const Petal = ({ delay, startX }) => {
  const translateY = useRef(new Animated.Value(-50)).current;
  const translateX = useRef(new Animated.Value(startX)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: height + 50,
          duration: 6000 + Math.random() * 4000, // Tốc độ rơi ngẫu nhiên
          delay: delay,
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: startX + (Math.random() * 100 - 50), // Bay lượn qua lại
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
      {/* Ký tự hoa đào, bạn có thể thay bằng Image cánh hoa thật nếu có trong thư mục assets */}
      <Text style={{ fontSize: 14 + Math.random() * 8, color: '#FFB7C5', opacity: 0.8 }}>🌸</Text>
    </Animated.View>
  );
};

const FallingBlossoms = () => {
  // Tạo 20 cánh hoa rơi với vị trí và độ trễ khác nhau
  const petals = Array.from({ length: 20 }).map((_, i) => (
    <Petal key={i} delay={Math.random() * 5000} startX={Math.random() * width} />
  ));
  return <View style={StyleSheet.absoluteFillObject}>{petals}</View>;
};


// --- MÀN HÌNH CHÍNH: ĐĂNG NHẬP ---
const LoginScreen = ({ navigation }) => {
  const { isDarkMode, colors } = useAppTheme();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }] }>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
      
      {/* Nền ảnh huyền bí */}
      <ImageBackground
        source={{ uri: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?q=80&w=800&auto=format&fit=crop' }}
        style={styles.backgroundImage}
      >
        {/* Lớp phủ làm tối nền */}
        <View style={[styles.overlay, { backgroundColor: colors.overlay }]} />

        {/* Hiệu ứng hoa rơi */}
        <FallingBlossoms />

        <View style={styles.contentContainer}>
          {/* Logo & Tiêu đề */}
          <View style={styles.headerContainer}>
            <Text style={styles.brandName}>True Juice</Text>
            <Text style={styles.subtitle}>Thưởng thức sự tinh tế</Text>
          </View>

          {/* Form kính mờ (Glassmorphism) */}
          <View style={styles.glassForm}>
            <Text style={styles.formTitle}>Đăng Nhập</Text>

            {/* Ô nhập Tên đăng nhập */}
            <View style={styles.inputWrapper}>
              <Ionicons name="person-outline" size={20} color="#D4AF37" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Tên đăng nhập hoặc Email"
                placeholderTextColor="#A9A9A9"
                value={username}
                onChangeText={setUsername}
              />
            </View>

            {/* Ô nhập Mật khẩu */}
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color="#D4AF37" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Mật khẩu"
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

            <TouchableOpacity style={styles.forgotPassword} onPress={() => navigation?.navigate('ForgotPassword')}>
              <Text style={styles.forgotPasswordText}>Quên mật khẩu?</Text>
            </TouchableOpacity>

            {/* Nút Đăng nhập Vàng Gold */}
            <TouchableOpacity style={styles.loginButton} onPress={() => navigation?.replace('MainTabs')}>
              <Text style={styles.loginButtonText}>BẮT ĐẦU HÀNH TRÌNH</Text>
            </TouchableOpacity>

            {/* Hoặc kết nối qua */}
            <View style={styles.socialContainer}>
              <Text style={styles.socialText}>Hoặc kết nối với</Text>
              <View style={styles.socialButtons}>
                <TouchableOpacity style={[styles.socialIconBtn, { backgroundColor: 'rgba(59, 89, 152, 0.5)' }]}>
                  <FontAwesome5 name="facebook-f" size={18} color="#FFF" />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.socialIconBtn, { backgroundColor: 'rgba(219, 68, 55, 0.5)' }]}>
                  <FontAwesome5 name="google" size={18} color="#FFF" />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.socialIconBtn, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}>
                  <FontAwesome5 name="apple" size={20} color="#FFF" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Chuyển sang Đăng ký */}
          <View style={styles.signupContainer}>
            <Text style={styles.signupText}>Chưa có thẻ thành viên? </Text>
            <TouchableOpacity onPress={() => navigation?.navigate('SignUp')}>
              <Text style={styles.signupLink}>Tạo ngay</Text>
            </TouchableOpacity>
          </View>
        </View>
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
    backgroundColor: 'rgba(10, 10, 10, 0.65)', // Làm tối nền để nổi bật form và hoa đào
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 25,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  brandName: {
    fontSize: 36,
    fontWeight: '800',
    color: '#D4AF37', // Vàng Gold
    letterSpacing: 3,
    textShadowColor: 'rgba(212, 175, 55, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#FFF',
    fontStyle: 'italic',
    marginTop: 5,
    letterSpacing: 1,
    opacity: 0.8,
  },
  glassForm: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    padding: 25,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    // Bóng đổ để tạo cảm giác nổi
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 5,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 25,
    textAlign: 'center',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 12,
    marginBottom: 15,
    paddingHorizontal: 15,
    height: 55,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)', // Viền vàng mờ
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#FFF',
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 25,
  },
  forgotPasswordText: {
    color: '#D4AF37',
    fontSize: 14,
    fontWeight: '500',
  },
  loginButton: {
    backgroundColor: '#D4AF37', // Vàng Gold
    borderRadius: 12,
    height: 55,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
  loginButtonText: {
    color: '#1A1A1A', // Chữ tối trên nền vàng
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  socialContainer: {
    marginTop: 30,
    alignItems: 'center',
  },
  socialText: {
    color: '#A9A9A9',
    fontSize: 14,
    marginBottom: 15,
  },
  socialButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  socialIconBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 30,
  },
  signupText: {
    color: '#FFF',
    fontSize: 15,
  },
  signupLink: {
    color: '#D4AF37',
    fontSize: 15,
    fontWeight: 'bold',
  },
});

export default LoginScreen;