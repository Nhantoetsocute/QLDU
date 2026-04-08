import { NativeModules, Platform } from 'react-native';
import Constants from 'expo-constants';

const API_PORT = process.env.EXPO_PUBLIC_API_PORT || '3000';
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

const getExpoHost = () => {
	const hostUri =
		Constants.expoConfig?.hostUri ||
		Constants.manifest2?.extra?.expoGo?.developer?.hostUri ||
		Constants.manifest?.debuggerHost ||
		NativeModules.SourceCode?.scriptURL;

	if (!hostUri) {
		return Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
	}

	const cleanedHost = hostUri
		.replace(/^https?:\/\//, '')
		.replace(/^exp:\/\//, '')
		.split('/')[0]
		.split(':')[0];

	return cleanedHost || (Platform.OS === 'android' ? '10.0.2.2' : 'localhost');
};

export const BASE_URL = API_BASE_URL || `http://${getExpoHost()}:${API_PORT}`;

/**
 * Helper tạo full URL từ path.
 * Ưu tiên EXPO_PUBLIC_API_BASE_URL, nếu không có sẽ tự lấy host Expo đang chạy.
 */
export const apiUrl = (path) => `${BASE_URL}${path}`;
