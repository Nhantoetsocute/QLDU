import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ImageBackground,
  Dimensions,
  Animated,
  StatusBar,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme/ThemeContext';

const { width, height } = Dimensions.get('window');

// --- COMPONENT: TINH TÚ LẤP LÁNH (TWINKLING STARS) ---
const Star = ({ delay, top, left, size }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 0.8,
            duration: 1500 + Math.random() * 1000,
            delay: delay,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1.2,
            duration: 1500 + Math.random() * 1000,
            delay: delay,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 0,
            duration: 1500 + Math.random() * 1000,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 0.5,
            duration: 1500 + Math.random() * 1000,
            useNativeDriver: true,
          }),
        ]),
      ])
    ).start();
  }, [delay]);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: top,
        left: left,
        opacity: opacity,
        transform: [{ scale: scale }],
      }}
    >
      <Text style={{ color: '#D4AF37', fontSize: size, textShadowColor: '#D4AF37', textShadowRadius: 8 }}>
        ✦
      </Text>
    </Animated.View>
  );
};

const MagicalBackground = () => {
  // Tạo 25 ngôi sao lấp lánh ngẫu nhiên trên màn hình
  const stars = Array.from({ length: 25 }).map((_, i) => (
    <Star 
      key={i} 
      delay={Math.random() * 3000} 
      top={Math.random() * height} 
      left={Math.random() * width} 
      size={10 + Math.random() * 15} 
    />
  ));
  return <View style={StyleSheet.absoluteFillObject} pointerEvents="none">{stars}</View>;
};


// --- MÀN HÌNH CHÍNH: KHÔI PHỤC MẬT KHẨU ---
const ForgotPasswordScreen = ({ navigation }) => {
  const { isDarkMode, colors } = useAppTheme();

  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Hiệu ứng mờ dần khi chuyển bước
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const animateStepChange = (nextStep) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
    setTimeout(() => setStep(nextStep), 200);
  };

  const handleBack = () => {
    if (step > 1) {
      animateStepChange(step - 1);
    } else {
      navigation?.goBack();
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }] }>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
      
      {/* Nền ảnh máy pha cà phê sang trọng */}
      <ImageBackground
        source={{ uri: 'https://images.unsplash.com/photo-1511920170033-f8396924c348?q=80&w=800&auto=format&fit=crop' }}
        style={styles.backgroundImage}
      >
        <View style={[styles.overlay, { backgroundColor: colors.overlay }]} />
        <MagicalBackground />

        <SafeAreaView style={{ flex: 1 }}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            {/* Header Nút Back */}
            <View style={styles.header}>
              <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                <Ionicons name="chevron-back" size={32} color="#D4AF37" />
              </TouchableOpacity>
            </View>

            <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
              
              {/* BƯỚC 1: NHẬP EMAIL */}
              {step === 1 && (
                <View style={styles.glassForm}>
                  <Text style={styles.title}>KHÔI PHỤC{'\n'}ĐẶC QUYỀN</Text>
                  <Text style={styles.subtitle}>
                    Nhập email định danh của bạn để chúng tôi gửi mã xác thực an toàn.
                  </Text>

                  <View style={styles.inputWrapper}>
                    <MaterialCommunityIcons name="email-outline" size={20} color="#D4AF37" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Email của bạn"
                      placeholderTextColor="#A9A9A9"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      value={email}
                      onChangeText={setEmail}
                    />
                  </View>

                  <TouchableOpacity style={styles.mainButton} onPress={() => animateStepChange(2)}>
                    <Text style={styles.mainButtonText}>GỬI MÃ XÁC THỰC</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* BƯỚC 2: XÁC NHẬN OTP */}
              {step === 2 && (
                <View style={styles.glassForm}>
                  <Text style={styles.title}>XÁC NHẬN{'\n'}DANH TÍNH</Text>
                  <Text style={styles.subtitle}>
                    Mã xác thực đã được gửi đến{'\n'}
                    <Text style={styles.highlightText}>{email || 'email của bạn'}</Text>.
                  </Text>

                  <View style={styles.inputWrapper}>
                    <FontAwesome5 name="key" size={16} color="#D4AF37" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Nhập mã OTP (6 số)"
                      placeholderTextColor="#A9A9A9"
                      keyboardType="numeric"
                      maxLength={6}
                      value={otp}
                      onChangeText={setOtp}
                    />
                  </View>

                  <TouchableOpacity style={styles.mainButton} onPress={() => animateStepChange(3)}>
                    <Text style={styles.mainButtonText}>TIẾP TỤC</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* BƯỚC 3: ĐẶT MẬT KHẨU MỚI */}
              {step === 3 && (
                <View style={styles.glassForm}>
                  <Text style={styles.title}>THIẾT LẬP{'\n'}CHÌA KHÓA MỚI</Text>
                  <Text style={styles.subtitle}>
                    Tạo mật khẩu bảo mật mới cho tài khoản True Juice của bạn.
                  </Text>

                  <View style={styles.inputWrapper}>
                    <Ionicons name="lock-closed-outline" size={20} color="#D4AF37" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Mật khẩu mới"
                      placeholderTextColor="#A9A9A9"
                      secureTextEntry={!showNewPassword}
                      value={newPassword}
                      onChangeText={setNewPassword}
                    />
                    <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)}>
                      <Ionicons name={showNewPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#D4AF37" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.inputWrapper}>
                    <Ionicons name="lock-closed-outline" size={20} color="#D4AF37" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Xác nhận mật khẩu"
                      placeholderTextColor="#A9A9A9"
                      secureTextEntry={!showConfirmPassword}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                    />
                    <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                      <Ionicons name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#D4AF37" />
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity style={styles.mainButton} onPress={() => navigation?.navigate('Login')}>
                    <Text style={styles.mainButtonText}>HOÀN TẤT ĐỔI MẬT KHẨU</Text>
                  </TouchableOpacity>
                </View>
              )}

            </Animated.View>
          </KeyboardAvoidingView>
        </SafeAreaView>
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
    backgroundColor: 'rgba(20, 15, 10, 0.75)', // Nền tối ám chút nâu đen
  },
  header: {
    paddingHorizontal: 15,
    marginTop: Platform.OS === 'android' ? 40 : 10,
  },
  backButton: {
    padding: 10,
    alignSelf: 'flex-start',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 25,
    paddingBottom: 50,
  },
  glassForm: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    padding: 25,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 5,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#D4AF37', // Vàng Gold
    letterSpacing: 2,
    lineHeight: 36,
    marginBottom: 10,
    textShadowColor: 'rgba(212, 175, 55, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 5,
  },
  subtitle: {
    fontSize: 14,
    color: '#E0E0E0',
    marginBottom: 30,
    lineHeight: 22,
    opacity: 0.9,
  },
  highlightText: {
    fontWeight: 'bold',
    color: '#D4AF37',
    fontStyle: 'italic',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
    marginBottom: 20,
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
  mainButton: {
    backgroundColor: '#D4AF37',
    borderRadius: 12,
    height: 55,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 5,
  },
  mainButtonText: {
    color: '#1A1A1A',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1.2,
  },
});

export default ForgotPasswordScreen;