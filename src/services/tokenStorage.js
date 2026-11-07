import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Web sessions live only in memory; refreshing requires login.
let webToken = null;
const KEY = 'qldu.auth.token';
export const tokenStorage = {
  get: () => Platform.OS === 'web' ? Promise.resolve(webToken) : SecureStore.getItemAsync(KEY),
  set: (token) => {
    if (Platform.OS === 'web') { webToken = token; return Promise.resolve(); }
    return SecureStore.setItemAsync(KEY, token, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  },
  remove: () => {
    if (Platform.OS === 'web') { webToken = null; return Promise.resolve(); }
    return SecureStore.deleteItemAsync(KEY);
  },
};
