import React, { createContext, useContext, useMemo, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const UserProfileContext = createContext(null);

export const UserProfileProvider = ({ children }) => {
  const [profile, setProfile] = useState(null); // Thay dummy data bằng null
  const [token, setToken] = useState(null);
  const [avatarUri, setAvatarUri] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Tự động khôi phục Token & Giữ phiên đăng nhập khi mở app
  useEffect(() => {
    const loadAuthData = async () => {
      try {
        const storedToken = await AsyncStorage.getItem('@user_token');
        const storedProfile = await AsyncStorage.getItem('@user_profile');
        if (storedToken && storedProfile) {
          setToken(storedToken);
          setProfile(JSON.parse(storedProfile));
        }
      } catch (error) {
        console.error("Lỗi khi load dữ liệu context:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadAuthData();
  }, []);

  const loginContext = useCallback(async (newToken, userProfile) => {
    try {
      await AsyncStorage.setItem('@user_token', newToken);
      await AsyncStorage.setItem('@user_profile', JSON.stringify(userProfile));
      setToken(newToken);
      setProfile(userProfile);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const logoutContext = useCallback(async () => {
    try {
      await AsyncStorage.removeItem('@user_token');
      await AsyncStorage.removeItem('@user_profile');
      setToken(null);
      setProfile(null);
    } catch (e) {}
  }, []);

  const updateProfile = useCallback((nextProfile) => {
    setProfile(nextProfile);
    AsyncStorage.setItem('@user_profile', JSON.stringify(nextProfile));
  }, []);

  const updateAvatar = useCallback((nextAvatarUri) => {
    setAvatarUri(nextAvatarUri);
    setProfile((prev) => {
      if (!prev) return prev;
      const updatedProfile = { ...prev, avatarUri: nextAvatarUri };
      AsyncStorage.setItem('@user_profile', JSON.stringify(updatedProfile));
      return updatedProfile;
    });
  }, []);

  const value = useMemo(
    () => ({
      profile,
      token,
      isLoading,
      avatarUri,
      loginContext,
      logoutContext,
      updateProfile,
      updateAvatar,
    }),
    [profile, token, isLoading, avatarUri, loginContext, logoutContext, updateProfile, updateAvatar]
  );

  return <UserProfileContext.Provider value={value}>{children}</UserProfileContext.Provider>;
};

export const useUserProfile = () => {
  const context = useContext(UserProfileContext);
  if (!context) {
    throw new Error('useUserProfile must be used within UserProfileProvider');
  }
  return context;
};
