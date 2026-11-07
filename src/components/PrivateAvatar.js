import React, { useEffect, useRef, useState } from 'react';
import { Image, View } from 'react-native';
import { BASE_URL } from '../config/api';
import { subscribePrivacyReset } from '../services/privacyStorage';

const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function aborted() {
  const error = new Error('Đã dừng tải ảnh.');
  error.name = 'AbortError';
  return error;
}

export async function fetchPrivateAvatar(uri, token, {
  signal,
  fetchImpl = fetch,
  FileReaderImpl = FileReader,
  baseUrl = BASE_URL,
} = {}) {
  const expected = new URL(baseUrl);
  const target = new URL(uri, expected.origin);
  if (target.origin !== expected.origin || target.pathname !== '/api/user/avatar'
      || target.username || target.password || target.hash
      || typeof token !== 'string' || !token || token.length > 4096) {
    throw new Error('Đường dẫn ảnh đại diện không hợp lệ.');
  }
  if (signal?.aborted) throw aborted();
  const response = await fetchImpl(target.href, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
    cache: 'no-store',
    redirect: 'error',
  });
  if (!response.ok) throw new Error('Chưa thể tải ảnh đại diện.');
  if (response.redirected || (response.url && new URL(response.url).origin !== expected.origin)) {
    throw new Error('Đường dẫn ảnh đại diện không hợp lệ.');
  }
  const type = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  const size = Number(response.headers.get('content-length'));
  if (!ALLOWED_TYPES.has(type) || (Number.isFinite(size) && size > AVATAR_MAX_BYTES)) throw new Error('Ảnh đại diện không hợp lệ.');
  const blob = await response.blob();
  if (blob.size > AVATAR_MAX_BYTES) throw new Error('Ảnh đại diện vượt giới hạn.');
  if (signal?.aborted) throw aborted();
  return new Promise((resolve, reject) => {
    const reader = new FileReaderImpl();
    const cleanup = () => signal?.removeEventListener('abort', onAbort);
    const onAbort = () => {
      try { reader.abort(); } catch { /* FileReader may already have completed. */ }
      cleanup();
      reject(aborted());
    };
    reader.onload = () => {
      cleanup();
      if (signal?.aborted) return reject(aborted());
      if (typeof reader.result !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/i.test(reader.result)) return reject(new Error('Ảnh đại diện không hợp lệ.'));
      resolve(reader.result);
    };
    reader.onerror = () => { cleanup(); reject(new Error('Chưa thể đọc ảnh đại diện.')); };
    reader.onabort = () => { cleanup(); reject(aborted()); };
    signal?.addEventListener('abort', onAbort, { once: true });
    reader.readAsDataURL(blob);
  });
}

const PrivateAvatar = ({ uri, token, style, onError, ...imageProps }) => {
  const [loaded, setLoaded] = useState(null);
  const generation = useRef(0);
  const controllerRef = useRef(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => subscribePrivacyReset(() => {
    ++generation.current;
    controllerRef.current?.abort();
    setLoaded(null);
  }), []);

  useEffect(() => {
    const epoch = ++generation.current;
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoaded(null);
    if (!uri || !token) return () => controller.abort();
    const timeout = setTimeout(() => controller.abort(), 12000);
    fetchPrivateAvatar(uri, token, { signal: controller.signal }).then((dataUri) => {
      if (epoch === generation.current && !controller.signal.aborted) setLoaded({ uri, token, dataUri });
    }).catch((error) => {
      if (epoch === generation.current && error.name !== 'AbortError') {
        onErrorRef.current?.({ nativeEvent: { error: 'Chưa thể tải ảnh đại diện.' } });
      }
    }).finally(() => clearTimeout(timeout));
    return () => { ++generation.current; clearTimeout(timeout); controller.abort(); };
  }, [uri, token]);

  if (!uri || !token || loaded?.uri !== uri || loaded?.token !== token) return <View style={style} />;
  return <Image {...imageProps} style={style} source={{ uri: loaded.dataUri }} onError={onError} />;
};

export default PrivateAvatar;
