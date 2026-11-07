import { NativeModules, Platform } from 'react-native';
import Constants from 'expo-constants';
import { apiOrigin, apiPath } from './transport';

const API_PORT = process.env.EXPO_PUBLIC_API_PORT || '3000';
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;
const development = typeof __DEV__ !== 'undefined' && __DEV__;

const getExpoHost = () => {
  const hostUri = Constants.expoConfig?.hostUri
    || Constants.manifest2?.extra?.expoGo?.developer?.hostUri
    || Constants.manifest?.debuggerHost
    || NativeModules.SourceCode?.scriptURL;
  if (hostUri) {
    try {
      const parsed = new URL(hostUri.includes('://') ? hostUri.replace(/^exp(s)?:/, 'http:') : `http://${hostUri}`);
      if (parsed.hostname) return parsed.hostname;
    } catch { /* Use the emulator default if Expo did not provide a usable host. */ }
  }
  return Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
};

export const BASE_URL = apiOrigin(API_BASE_URL || (development ? `http://${getExpoHost()}:${API_PORT}` : ''), { development });
export const apiUrl = (path) => apiPath(BASE_URL, path);
