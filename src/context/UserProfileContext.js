import React, { createContext, useContext, useMemo, useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { tokenStorage } from '../services/tokenStorage';
import { apiUrl } from '../config/api';
import { LEGACY_PROFILE_KEYS, clearAccountLocalData, normalizeProfile } from '../services/privacyStorage';

const UserProfileContext = createContext(null);

export const UserProfileProvider = ({ children }) => {
  const [profile, setProfile] = useState(null);
  const [token, setToken] = useState(null);
  const [avatarUri, setAvatarUri] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const sessionEpoch = useRef(0);
  const tokenTasks = useRef(Promise.resolve());

  const runTokenTask = useCallback((task) => {
    const next = tokenTasks.current.catch(() => {}).then(task);
    tokenTasks.current = next;
    return next;
  }, []);

  const clearIdentity = useCallback(() => {
    setToken(null);
    setProfile(null);
    setAvatarUri(null);
  }, []);

  useEffect(() => {
    let mounted = true;
    const epoch = sessionEpoch.current;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const loadAuthData = async () => {
      try {
        // Remove legacy plaintext identity. Profile PII is now held only in memory.
        await AsyncStorage.multiRemove(LEGACY_PROFILE_KEYS);
        const storedToken = await tokenStorage.get();
        if (!storedToken) return;
        const response = await fetch(apiUrl('/api/user/profile'), {
          headers: { Authorization: `Bearer ${storedToken}` },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('Phiên đăng nhập chưa được xác thực.');
        const nextProfile = normalizeProfile(await response.json());
        if (!mounted || epoch !== sessionEpoch.current) return;
        setProfile(nextProfile);
        setAvatarUri(nextProfile.avatar);
        setToken(storedToken);
      } catch {
        if (mounted && epoch === sessionEpoch.current) {
          clearIdentity();
          await Promise.allSettled([
            runTokenTask(() => tokenStorage.remove()),
            clearAccountLocalData(AsyncStorage),
          ]);
        }
      } finally {
        clearTimeout(timeout);
        if (mounted && epoch === sessionEpoch.current) setIsLoading(false);
      }
    };
    loadAuthData();
    return () => { mounted = false; clearTimeout(timeout); controller.abort(); };
  }, [clearIdentity, runTokenTask]);

  const loginContext = useCallback(async (newToken, userProfile) => {
    if (typeof newToken !== 'string' || !newToken || newToken.length > 4096) throw new Error('Phiên đăng nhập không hợp lệ.');
    const nextProfile = normalizeProfile(userProfile);
    const epoch = ++sessionEpoch.current;
    clearIdentity();
    try {
      const cleared = await Promise.allSettled([
        runTokenTask(() => tokenStorage.remove()),
        clearAccountLocalData(AsyncStorage),
      ]);
      if (cleared.some((result) => result.status === 'rejected')) throw new Error('Chưa thể xóa phiên cũ trên thiết bị.');
      if (epoch !== sessionEpoch.current) return;
      await runTokenTask(() => tokenStorage.set(newToken));
      if (epoch !== sessionEpoch.current) return;
      setToken(newToken);
      setProfile(nextProfile);
      setAvatarUri(nextProfile.avatar);
    } finally {
      if (epoch === sessionEpoch.current) setIsLoading(false);
    }
  }, [clearIdentity, runTokenTask]);

  const logoutContext = useCallback(async () => {
    ++sessionEpoch.current;
    clearIdentity();
    setIsLoading(false);
    const results = await Promise.allSettled([
      runTokenTask(() => tokenStorage.remove()),
      clearAccountLocalData(AsyncStorage),
    ]);
    if (results.some((result) => result.status === 'rejected')) {
      throw new Error('Chưa thể xóa hết dữ liệu trên thiết bị. Vui lòng thử đăng xuất lại.');
    }
  }, [clearIdentity, runTokenTask]);

  const updateProfile = useCallback((nextProfile) => {
    setProfile((previous) => previous ? normalizeProfile({ ...previous, ...nextProfile }) : null);
  }, []);

  const updateAvatar = useCallback((nextAvatarUri) => {
    setAvatarUri(nextAvatarUri);
    setProfile((previous) => previous ? normalizeProfile({ ...previous, avatar: nextAvatarUri }) : null);
  }, []);

  const value = useMemo(() => ({
    profile, token, isLoading, avatarUri, loginContext, logoutContext, updateProfile, updateAvatar,
  }), [profile, token, isLoading, avatarUri, loginContext, logoutContext, updateProfile, updateAvatar]);

  return <UserProfileContext.Provider value={value}>{children}</UserProfileContext.Provider>;
};

export const useUserProfile = () => {
  const context = useContext(UserProfileContext);
  if (!context) throw new Error('useUserProfile must be used within UserProfileProvider');
  return context;
};
