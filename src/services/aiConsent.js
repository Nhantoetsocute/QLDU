import AsyncStorage from '@react-native-async-storage/async-storage';
import { subscribePrivacyReset } from './privacyStorage';

const KEY = '@qldu_ai_consent';
export const AI_CONSENT_VERSION = '2026-11-07';
const listeners = new Set();
let generation = 0;
let consent = false;
let writes = Promise.resolve();
export const currentAiConsent = () => consent;
export const subscribeAiConsent = (listener) => { listeners.add(listener); return () => listeners.delete(listener); };
const emit = () => { for (const listener of listeners) listener(consent); };
export async function readAiConsent() {
  const started = generation;
  await writes.catch(() => {});
  const value = await AsyncStorage.getItem(KEY);
  if (started === generation) { consent = value === AI_CONSENT_VERSION; emit(); }
  return consent;
}
export async function setAiConsent(value) {
  const epoch = ++generation;
  // Revocation takes effect immediately for every mounted screen, before storage completes.
  consent = value === true;
  emit();
  const allowed = consent;
  const task = writes.catch(() => {}).then(async () => {
    if (epoch !== generation) return;
    if (allowed) await AsyncStorage.setItem(KEY, AI_CONSENT_VERSION);
    else await AsyncStorage.removeItem(KEY);
  });
  writes = task;
  return task;
}
export function resetAiConsent() { generation++; consent = false; emit(); }
// Logout waits for a grant already writing before deleting the consent key.
subscribePrivacyReset(() => { resetAiConsent(); return writes.catch(() => {}); });
