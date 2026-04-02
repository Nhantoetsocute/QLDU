import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Switch,
  ScrollView,
  StatusBar,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme/ThemeContext';
import { useUserProfile } from '../context/UserProfileContext';

const MenuScreen = ({ navigation }) => {
  const { isDarkMode, colors, toggleTheme } = useAppTheme();
  const { profile, avatarUri, logoutContext } = useUserProfile();

  const theme = {
    background: colors.background,
    card: colors.card,
    text: colors.text,
    subText: colors.subText,
    gold: colors.accent,
    border: colors.border,
  };

  // Component render từng dòng Menu
  const MenuItem = ({ icon, title, subtitle, rightElement, onPress, isDestructive }) => (
    <TouchableOpacity 
      style={[styles.menuItem, { borderBottomColor: theme.border }]} 
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
    >
      <View style={styles.menuItemLeft}>
        <View style={[styles.iconBox, { backgroundColor: isDestructive ? 'rgba(231, 76, 60, 0.1)' : 'rgba(212, 175, 55, 0.1)' }]}>
          <Ionicons name={icon} size={20} color={isDestructive ? '#E74C3C' : theme.gold} />
        </View>
        <View>
          <Text style={[styles.menuItemTitle, { color: isDestructive ? '#E74C3C' : theme.text }]}>{title}</Text>
          {subtitle && <Text style={[styles.menuItemSubtitle, { color: theme.subText }]}>{subtitle}</Text>}
        </View>
      </View>
      <View>
        {rightElement || <Ionicons name="chevron-forward" size={20} color={theme.subText} />}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />

      <SafeAreaView style={{ flex: 1 }}>
        {/* HEADER */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Tùy Chỉnh</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          
          {/* PROFILE CARD */}
          <TouchableOpacity
            style={[styles.profileCard, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={() => navigation.navigate('Profile')}
            activeOpacity={0.8}
          >
            {profile?.avatarUri || profile?.avatar ? (
              <Image 
                source={{ uri: profile.avatarUri || profile.avatar }}
                style={[styles.avatar, { borderColor: theme.gold }]} 
              />
            ) : (
              <View style={[styles.avatar, { borderColor: theme.gold, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(212, 175, 55, 0.1)' }]}>
                <Ionicons name="person" size={30} color={theme.gold} />
              </View>
            )}
            <View style={styles.profileInfo}>
              <Text style={[styles.profileName, { color: theme.text }]}>{profile?.name || "Thành viên mới"}</Text>
              <Text style={[styles.profileMember, { color: theme.gold }]}>Thành viên Vàng (Gold)</Text>
            </View>
            <TouchableOpacity
              style={[styles.editButton, { backgroundColor: 'rgba(212, 175, 55, 0.1)' }]}
              onPress={() => navigation.navigate('Profile')}
              activeOpacity={0.7}
            >
              <Feather name="edit-2" size={18} color={theme.gold} />
            </TouchableOpacity>
          </TouchableOpacity>

          {/* SECTION: HỆ THỐNG */}
          <Text style={[styles.sectionTitle, { color: theme.subText }]}>HỆ THỐNG</Text>
          <View style={[styles.sectionContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
            
            {/* Toggle Giao Diện Sáng/Tối */}
            <MenuItem 
              icon={isDarkMode ? "moon" : "sunny"} 
              title="Giao diện (Sáng/Tối)" 
              subtitle={isDarkMode ? "Chế độ Thượng Lưu (Dark)" : "Chế độ Thanh Lịch (Light)"}
              rightElement={
                <Switch
                  trackColor={{ false: "#D3D3D3", true: "#D4AF37" }}
                  thumbColor={"#FFF"}
                  ios_backgroundColor="#D3D3D3"
                  onValueChange={toggleTheme}
                  value={isDarkMode}
                />
              }
            />

            <MenuItem
              icon="notifications-outline"
              title="Thông báo"
              subtitle="Bật ưu đãi và trạng thái đơn"
              onPress={() => navigation.navigate('Notifications')}
            />
            <MenuItem
              icon="language-outline"
              title="Ngôn ngữ"
              rightElement={<Text style={{ color: theme.gold, fontWeight: 'bold' }}>Tiếng Việt</Text>}
              onPress={() => navigation.navigate('Language')}
            />
          </View>

          {/* SECTION: HỖ TRỢ & BẢO MẬT */}
          <Text style={[styles.sectionTitle, { color: theme.subText }]}>HỖ TRỢ & BẢO MẬT</Text>
          <View style={[styles.sectionContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <MenuItem icon="shield-checkmark-outline" title="Quyền riêng tư" onPress={() => navigation.navigate('Privacy')} />
            <MenuItem icon="help-buoy-outline" title="Trung tâm trợ giúp" onPress={() => navigation.navigate('HelpCenter')} />
            <MenuItem icon="document-text-outline" title="Điều khoản dịch vụ" onPress={() => navigation.navigate('Terms')} />
          </View>

          {/* ĐĂNG XUẤT */}
          <View style={[styles.sectionContainer, { backgroundColor: theme.card, borderColor: theme.border, marginTop: 20 }]}>
            <MenuItem 
              icon="log-out-outline" 
              title="Đăng xuất" 
              isDestructive={true} 
              onPress={async () => {
                await logoutContext();
                navigation.replace('Login');
              }}
            />
          </View>

          <Text style={styles.versionText}>Phiên bản 1.0.0 True Juice</Text>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 120, // Chừa khoảng trống cho thanh Tab dưới cùng
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  // Profile
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    marginRight: 15,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  profileMember: {
    fontSize: 13,
    fontWeight: '600',
  },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Sections
  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 10,
    marginLeft: 15,
  },
  sectionContainer: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 25,
  },
  // Menu Items
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  menuItemTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  menuItemSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  versionText: {
    textAlign: 'center',
    color: '#888',
    fontSize: 12,
    marginTop: 10,
  },
});

export default MenuScreen;