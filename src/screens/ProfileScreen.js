import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useUserProfile } from '../context/UserProfileContext';
import { useAppTheme } from '../theme/ThemeContext';

const ORANGE_COLOR = '#E57905';

const ProfileScreen = ({ navigation }) => {
  const { profile, avatarUri, updateProfile, updateAvatar } = useUserProfile();
  const { isDarkMode, colors } = useAppTheme();

  const ui = {
    bg: colors.background,
    card: isDarkMode ? '#1A1A1A' : '#F5F5F5',
    text: colors.text,
    subText: colors.subText,
    inputBg: isDarkMode ? 'rgba(255,255,255,0.08)' : '#F5F5F5',
    inputText: colors.text,
    border: colors.border,
    accent: colors.accent,
  };

  const [originalProfile, setOriginalProfile] = useState(profile || {});

  // Dữ liệu đang chỉnh sửa
  const [name, setName] = useState(profile?.name || '');
  const [email, setEmail] = useState(profile?.email || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [address, setAddress] = useState(profile?.address || '');

  useEffect(() => {
    if (profile) {
      setOriginalProfile(profile);
      setName(profile.name || '');
      setEmail(profile.email || '');
      setPhone(profile.phone || '');
      setAddress(profile.address || '');
    }
  }, [profile]);

  // Kiểm tra thay đổi để bật nút cập nhật
  const isChanged =
    name.trim() !== (originalProfile.name || '') ||
    email.trim() !== (originalProfile.email || '') ||
    phone.trim() !== (originalProfile.phone || '') ||
    address.trim() !== (originalProfile.address || '');

  const handlePickAvatar = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Thiếu quyền truy cập', 'Vui lòng cho phép ứng dụng truy cập thư viện ảnh.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.length) {
        updateAvatar(result.assets[0].uri);
        Alert.alert('Thành công', 'Ảnh đại diện đã được cập nhật.');
      }
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể chọn ảnh. Vui lòng thử lại.');
    }
  };

  const handleUpdate = () => {
    if (!isChanged) return;

    const nextProfile = {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      address: address.trim(),
    };

    if (!nextProfile.name || !nextProfile.email || !nextProfile.phone || !nextProfile.address) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập đầy đủ thông tin trước khi cập nhật.');
      return;
    }

    updateProfile(nextProfile);
    setOriginalProfile(nextProfile);
    setName(nextProfile.name);
    setEmail(nextProfile.email);
    setPhone(nextProfile.phone);
    setAddress(nextProfile.address);

    Alert.alert('Thành công', 'Thông tin tài khoản đã được cập nhật.');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: ui.bg }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={ui.bg} />
      
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={26} color={ui.accent} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: ui.text }]}>Cập nhật thông tin</Text>
        <View style={{ width: 26 }} />
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* KHU VỰC AVATAR */}
          <View style={styles.avatarContainer}>
            <TouchableOpacity onPress={handlePickAvatar} activeOpacity={0.85}>
              {typeof avatarUri === 'string' && avatarUri.trim() ? (
                <Image
                  source={{ uri: avatarUri }}
                  style={[styles.avatar, { borderColor: ui.accent }]}
                />
              ) : (
                <View style={[styles.avatar, { justifyContent: 'center', alignItems: 'center', backgroundColor: isDarkMode ? 'rgba(212,175,55,0.15)' : '#E5E7EB', borderColor: ui.accent }]}>
                  <Ionicons name="person" size={50} color={ui.accent} />
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.cameraButton, { backgroundColor: ui.accent }]} activeOpacity={0.8} onPress={handlePickAvatar}>
              <Ionicons name="camera" size={18} color={isDarkMode ? '#1A1A1A' : '#FFF'} />
            </TouchableOpacity>
          </View>

          {/* FORM NHẬP LIỆU */}
          <View style={styles.formContainer}>
            <Text style={[styles.label, { color: ui.text }]}>Họ và tên</Text>
            <TextInput
              style={[styles.input, { backgroundColor: ui.inputBg, color: ui.inputText }]}
              value={name}
              onChangeText={setName}
              placeholder="Nhập họ và tên"
              placeholderTextColor={ui.subText}
            />

            <Text style={[styles.label, { color: ui.text }]}>Email</Text>
            <TextInput
              style={[styles.input, { backgroundColor: ui.inputBg, color: ui.inputText }]}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="Nhập email"
              placeholderTextColor={ui.subText}
            />

            <Text style={[styles.label, { color: ui.text }]}>Số điện thoại</Text>
            <TextInput
              style={[styles.input, { backgroundColor: ui.inputBg, color: ui.inputText }]}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="Nhập số điện thoại"
              placeholderTextColor={ui.subText}
            />

            <Text style={[styles.label, { color: ui.text }]}>Địa chỉ</Text>
            <TextInput
              style={[styles.input, { backgroundColor: ui.inputBg, color: ui.inputText }]}
              value={address}
              onChangeText={setAddress}
              placeholder="Nhập địa chỉ"
              placeholderTextColor={ui.subText}
            />
          </View>

          {/* NÚT CẬP NHẬT */}
          <TouchableOpacity 
            style={[styles.updateButton, { backgroundColor: isDarkMode ? '#333' : '#E5E5E5' }, isChanged && { backgroundColor: ui.accent }]}
            onPress={handleUpdate}
            disabled={!isChanged}
            activeOpacity={0.8}
          >
            <Text style={[styles.updateButtonText, { color: isDarkMode ? '#666' : '#888' }, isChanged && { color: isDarkMode ? '#1A1A1A' : '#FFF' }]}>
              Cập nhật tài khoản
            </Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 15,
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  // --- Avatar ---
  avatarContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
    alignSelf: 'center',
    position: 'relative',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#666', // Màu xám đậm như trong ảnh
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  // --- Form ---
  formContainer: {
    marginBottom: 40,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F5F5F5', // Nền xám nhạt
    height: 50,
    borderRadius: 10,
    paddingHorizontal: 15,
    fontSize: 15,
    color: '#000',
    marginBottom: 20,
  },
  // --- Button ---
  updateButton: {
    backgroundColor: '#E5E5E5', // Màu xám nhạt (trạng thái disable/chưa chỉnh sửa)
    height: 52,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  updateButtonActive: {
    backgroundColor: ORANGE_COLOR, // Chuyển cam nếu có chỉnh sửa
  },
  updateButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#888', // Màu chữ xám
  },
  updateButtonTextActive: {
    color: '#FFF',
  },
});

export default ProfileScreen;