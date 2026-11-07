import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiUrl } from '../config/api';
import { readAiConsent, setAiConsent, subscribeAiConsent, resetAiConsent } from '../services/aiConsent';
import { subscribePrivacyReset } from '../services/privacyStorage';
import { resolveCatalogImage, toProductItem } from '../services/catalog';
import { useUserProfile } from '../context/UserProfileContext';
import { useAppTheme } from '../theme/ThemeContext';

const MAX_MESSAGE_LENGTH = 1000;
const REQUEST_TIMEOUT_MS = 30000;
const WELCOME = 'Xin chào! Mình là trợ lý AI của True Juice. Mình có thể giúp bạn tìm đồ uống yêu thích, tư vấn sản phẩm hoặc cung cấp thông tin cửa hàng. Hôm nay bạn muốn uống gì ạ?';
const SUGGESTIONS = [
  'Hôm nay nên uống gì?',
  'Có món nào dưới 50.000đ không?',
  'Cửa hàng có những loại nước ép nào?',
  'Địa chỉ cửa hàng ở đâu?',
];

// Keep complete user/assistant pairs within the backend's history limits.
export const buildChatHistory = (history) => {
  const bounded = history.slice(-12).map(({ role, content }) => ({
    role,
    content: content.slice(0, role === 'user' ? MAX_MESSAGE_LENGTH : 2000),
  }));
  let total = bounded.reduce((length, item) => length + item.content.length, 0);
  while (total > 16000 && bounded.length >= 2) {
    total -= bounded[0].content.length + bounded[1].content.length;
    bounded.splice(0, 2);
  }
  return bounded;
};

const formatPrice = (price) => `${Number(price).toLocaleString('vi-VN')} đ`;

const ChatScreen = ({ navigation }) => {
  const { colors, isDarkMode } = useAppTheme();
  const { token } = useUserProfile();
  const styles = useMemo(() => createStyles(colors, isDarkMode), [colors, isDarkMode]);
  const [messages, setMessages] = useState([{ id: 'welcome', role: 'assistant', content: WELCOME, products: [] }]);
  const [draft, setDraft] = useState('');
  const [aiAllowed, setAiAllowed] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [failure, setFailure] = useState(null);
  const [retryAvailableAt, setRetryAvailableAt] = useState(0);
  const [retryCountdown, setRetryCountdown] = useState(0);
  const listRef = useRef(null);
  const historyRef = useRef([]);
  const controllerRef = useRef(null);
  const sendingRef = useRef(false);
  const mountedRef = useRef(true);
  const sequenceRef = useRef(0);
  const consentRef = useRef(false);
  const sessionRef = useRef(0);

  useEffect(() => {
    const clearChat = () => {
      sessionRef.current++;
      controllerRef.current?.abort();
      controllerRef.current = null;
      sendingRef.current = false;
      historyRef.current = [];
      setMessages([{id:'welcome',role:'assistant',content:WELCOME,products:[]}]);
      setDraft(''); setFailure(null); setIsSending(false); setRetryAvailableAt(0);
    };
    const offConsent = subscribeAiConsent((allowed) => {
      consentRef.current = allowed; setAiAllowed(allowed);
      if (!allowed) clearChat();
    });
    const offPrivacy = subscribePrivacyReset(() => { resetAiConsent(); clearChat(); });
    readAiConsent().catch(() => { consentRef.current = false; setAiAllowed(false); });
    return () => { offConsent(); offPrivacy(); };
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!retryAvailableAt) {
      setRetryCountdown(0);
      return undefined;
    }
    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil((retryAvailableAt - Date.now()) / 1000));
      setRetryCountdown(remaining);
      if (!remaining) setRetryAvailableAt(0);
    };
    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [retryAvailableAt]);

  const scrollToLatest = () => listRef.current?.scrollToEnd({ animated: true });

  const sendMessage = async (input, retryMessageId = null) => {
    const message = input.trim();
    if (!consentRef.current || !token || !message || message.length > MAX_MESSAGE_LENGTH || sendingRef.current || Date.now() < retryAvailableAt) return;

    const session = sessionRef.current;
    const messageId = retryMessageId || `user-${Date.now()}-${++sequenceRef.current}`;
    const previousHistory = buildChatHistory(historyRef.current);
    sendingRef.current = true;
    setIsSending(true);
    setFailure(null);
    if (!retryMessageId) {
      setDraft('');
      setMessages((previous) => [...previous, { id: messageId, role: 'user', content: message, status: 'pending' }]);
    } else {
      setMessages((previous) => previous.map((item) => item.id === messageId ? { ...item, status: 'pending' } : item));
    }

    const controller = new AbortController();
    controllerRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(apiUrl('/api/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ message, history: previousHistory, aiConsent: true }),
        signal: controller.signal,
      });
      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error('Máy chủ chưa trả về phản hồi hợp lệ. Bạn vui lòng thử lại sau.');
      }

      if (!response.ok || data?.success !== true || typeof data.reply !== 'string' || !data.reply.trim()) {
        if (response.status === 429) {
          const seconds = Math.max(1, Math.min(3600, Number(data?.retryAfter || response.headers.get('Retry-After')) || 60));
          if (mountedRef.current) setRetryAvailableAt(Date.now() + seconds * 1000);
        }
        const error = new Error(typeof data?.error === 'string' ? data.error : 'Trợ lý chưa thể trả lời lúc này. Bạn vui lòng thử lại sau.');
        error.code = data?.code;
        throw error;
      }

      if (!mountedRef.current || session !== sessionRef.current || !consentRef.current) return;
      const reply = data.reply.trim();
      // Product cards come only from the backend's validated database results.
      const products = Array.isArray(data.products) ? data.products.filter((product) =>
        product && product.id != null && typeof product.name === 'string' && Number.isFinite(Number(product.price))
      ) : [];
      historyRef.current = buildChatHistory([...previousHistory, { role: 'user', content: message }, { role: 'assistant', content: reply }]);
      setMessages((previous) => [
        ...previous.map((item) => item.id === messageId ? { ...item, status: 'sent' } : item),
        { id: `assistant-${Date.now()}-${++sequenceRef.current}`, role: 'assistant', content: reply, products },
      ]);
    } catch (error) {
      if (!mountedRef.current || session !== sessionRef.current || !consentRef.current) return;
      const isNetworkError = error instanceof TypeError || /network|fetch failed|network request failed/i.test(error?.message || '');
      const errorMessage = error?.name === 'AbortError'
        ? 'Trợ lý phản hồi hơi lâu. Bạn có thể thử lại sau, khi kết nối ổn định hơn.'
        : isNetworkError
          ? 'Không kết nối được máy chủ. Hãy kiểm tra Wi-Fi trên điện thoại và đảm bảo backend đang chạy.'
          : error.message || 'Có lỗi xảy ra khi gửi tin nhắn. Bạn vui lòng thử lại.';
      setMessages((previous) => previous.map((item) => item.id === messageId ? { ...item, status: 'failed' } : item));
      setFailure({ message: errorMessage, question: message, messageId, code: error.code });
    } finally {
      clearTimeout(timeout);
      if (controllerRef.current === controller) controllerRef.current = null;
      if (session === sessionRef.current) {
        sendingRef.current = false;
        if (mountedRef.current) setIsSending(false);
      }
    }
  };

  const renderProduct = (product) => {
    const image = resolveCatalogImage(product.image);
    const imageSource = typeof image === 'string' ? { uri: image } : image;
    return (
      <View key={String(product.id)} style={styles.productCard}>
        {imageSource ? <Image source={imageSource} style={styles.productImage} /> : (
          <View style={[styles.productImage, styles.imageFallback]}><Ionicons name="cafe-outline" size={30} color={colors.accent} /></View>
        )}
        <View style={styles.productBody}>
          <Text style={styles.productName}>{product.name}</Text>
          <Text style={styles.productPrice}>{formatPrice(product.price)}</Text>
          {!!product.description && <Text numberOfLines={3} style={styles.productDescription}>{product.description}</Text>}
          <TouchableOpacity
            style={styles.detailButton}
            onPress={() => navigation.navigate('ProductDetail', { item: toProductItem(product) })}
            accessibilityRole="button"
            accessibilityLabel={`Xem chi tiết ${product.name}`}
          >
            <Text style={styles.detailButtonText}>Xem chi tiết</Text>
            <Ionicons name="arrow-forward" size={15} color={colors.accent} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderMessage = ({ item }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.messageRow, isUser && styles.userRow]}>
        {!isUser && <View style={styles.smallAvatar}><Ionicons name="leaf" size={16} color={colors.accent} /></View>}
        <View style={[styles.messageColumn, isUser && styles.userColumn]}>
          {!isUser && <Text style={styles.messageSender}>TRUE JUICE AI</Text>}
          <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
            <Text selectable style={[styles.messageText, isUser && styles.userText]}>{item.content}</Text>
          </View>
          {item.status === 'failed' && <Text style={styles.unsentLabel}>Chưa gửi thành công</Text>}
          {!isUser && item.products?.map(renderProduct)}
        </View>
      </View>
    );
  };

  const canSend = aiAllowed && !!token && !!draft.trim() && !isSending && !retryCountdown;
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Quay lại">
          <Ionicons name="chevron-back" size={25} color={colors.accent} />
        </TouchableOpacity>
        <View style={styles.headerAvatar}><Ionicons name="leaf" size={22} color={colors.accent} /></View>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Trợ lý AI True Juice</Text>
          <Text style={styles.headerSubtitle}>Tư vấn sản phẩm & cửa hàng</Text>
        </View>
      </View>

      {!aiAllowed && (
        <View style={{padding:16,backgroundColor:colors.card}}>
          <Text style={{color:colors.text,lineHeight:21}}>Câu hỏi và lịch sử chat gần đây sẽ được gửi tới Google Gemini. Với gói miễn phí, Google có thể dùng nội dung để cải thiện sản phẩm. Không gửi thông tin cá nhân hay bí mật. Bạn có thể tắt chia sẻ tại Quyền riêng tư.</Text>
          <TouchableOpacity accessibilityRole="button" onPress={async () => {
            try { await setAiConsent(true); } catch { await setAiConsent(false).catch(() => {}); }
          }} style={{paddingVertical:12}}>
            <Text style={{color:colors.accent,fontWeight:'700'}}>Tôi đồng ý sử dụng trợ lý AI</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Privacy')}>
            <Text style={{color:colors.subText}}>Xem quyền riêng tư và lựa chọn dữ liệu</Text>
          </TouchableOpacity>
        </View>
      )}

      <KeyboardAvoidingView style={styles.chatArea} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
        <FlatList
          ref={listRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messageList}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={scrollToLatest}
          onLayout={scrollToLatest}
          ListHeaderComponent={<Text style={styles.sessionLabel}>CÙNG CHỌN MÓN BẠN YÊU THÍCH</Text>}
          ListFooterComponent={
            <>
              {messages.length === 1 && <View style={styles.suggestions}>
                {SUGGESTIONS.map((question) => <TouchableOpacity key={question} style={styles.suggestion} onPress={() => sendMessage(question)} disabled={!aiAllowed || !token || isSending || !!retryCountdown} accessibilityRole="button">
                  <Text style={styles.suggestionText}>{question}</Text><Ionicons name="arrow-up-outline" size={15} color={colors.accent} />
                </TouchableOpacity>)}
              </View>}
              {isSending && <View style={styles.loadingRow} accessibilityLiveRegion="polite">
                <ActivityIndicator color={colors.accent} size="small" /><Text style={styles.loadingText}>True Juice đang tư vấn cho bạn…</Text>
              </View>}
              {failure && <View style={styles.errorCard} accessibilityLiveRegion="polite">
                <View style={styles.errorHeading}><Ionicons name="information-circle-outline" size={19} color={styles.errorText.color} /><Text style={styles.errorTitle}>Chưa thể gửi câu trả lời</Text></View>
                <Text style={styles.errorText}>{failure.message}</Text>
                <TouchableOpacity
                  style={[styles.retryButton, (isSending || !!retryCountdown) && styles.disabled]}
                  onPress={() => sendMessage(failure.question, failure.messageId)}
                  disabled={!aiAllowed || !token || isSending || !!retryCountdown}
                  accessibilityRole="button"
                  accessibilityLabel="Thử gửi lại tin nhắn"
                >
                  <Ionicons name="refresh" size={16} color={colors.accent} /><Text style={styles.retryText}>{retryCountdown ? `Thử lại sau ${retryCountdown}s` : 'Thử lại'}</Text>
                </TouchableOpacity>
              </View>}
            </>
          }
        />

        <View style={styles.composerContainer}>
          <View style={styles.composer}>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder="Bạn muốn True Juice tư vấn gì?"
              placeholderTextColor={colors.subText}
              maxLength={MAX_MESSAGE_LENGTH}
              multiline
              scrollEnabled
              editable={!isSending}
              keyboardAppearance={isDarkMode ? 'dark' : 'light'}
              accessibilityLabel="Câu hỏi cho trợ lý AI"
            />
            <TouchableOpacity
              style={[styles.sendButton, !canSend && styles.disabled]}
              onPress={() => sendMessage(draft)}
              disabled={!canSend}
              accessibilityRole="button"
              accessibilityLabel="Gửi tin nhắn"
            >
              {isSending ? <ActivityIndicator size="small" color={styles.sendIcon.color} /> : <Ionicons name="arrow-up" size={23} color={styles.sendIcon.color} />}
            </TouchableOpacity>
          </View>
          <Text style={styles.composerHint}>{retryCountdown ? `Vui lòng chờ ${retryCountdown}s trước khi gửi tiếp.` : `${draft.length}/${MAX_MESSAGE_LENGTH} · Chỉ tư vấn sản phẩm và thông tin True Juice`}</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const createStyles = (colors, isDarkMode) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  backButton: { width: 36, height: 42, alignItems: 'flex-start', justifyContent: 'center' },
  headerAvatar: { height: 42, width: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 15, backgroundColor: isDarkMode ? '#211D10' : '#FFF9E8' },
  headerCopy: { flex: 1, marginLeft: 12 },
  headerTitle: { color: colors.text, fontWeight: '700', fontSize: 17 },
  headerSubtitle: { color: colors.subText, fontSize: 12, marginTop: 5 },
  chatArea: { flex: 1 },
  messageList: { padding: 18, paddingBottom: 28, flexGrow: 1 },
  sessionLabel: { color: colors.subText, textAlign: 'center', fontSize: 10, fontWeight: '600', letterSpacing: 1.3, marginVertical: 14, marginBottom: 26 },
  messageRow: { flexDirection: 'row', marginBottom: 22, alignItems: 'flex-start' },
  userRow: { justifyContent: 'flex-end' },
  smallAvatar: { width: 30, height: 30, borderRadius: 11, backgroundColor: isDarkMode ? '#211D10' : '#FFF9E8', alignItems: 'center', justifyContent: 'center', marginRight: 9, marginTop: 18 },
  messageColumn: { flex: 1, maxWidth: '90%' },
  userColumn: { flex: 0, maxWidth: '86%', alignItems: 'flex-end' },
  messageSender: { color: colors.accent, fontWeight: '700', letterSpacing: 1.2, fontSize: 9, marginBottom: 8 },
  bubble: { padding: 15, borderRadius: 18 },
  assistantBubble: { backgroundColor: isDarkMode ? '#181818' : '#FFFFFF', borderTopLeftRadius: 4, borderWidth: 1, borderColor: colors.border },
  userBubble: { backgroundColor: colors.accent, borderBottomRightRadius: 4 },
  messageText: { color: colors.text, fontSize: 15, lineHeight: 23 },
  userText: { color: isDarkMode ? '#1A1A1A' : '#FFFFFF' },
  unsentLabel: { color: isDarkMode ? '#FFB4AB' : '#A82B22', fontSize: 11, marginTop: 7 },
  suggestions: { marginLeft: 39, marginTop: -4, marginBottom: 12, gap: 9 },
  suggestion: { borderWidth: 1, borderColor: colors.border, paddingVertical: 12, paddingHorizontal: 13, borderRadius: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, backgroundColor: isDarkMode ? '#14130E' : '#FFFCF3' },
  suggestionText: { flex: 1, color: colors.text, fontSize: 13, lineHeight: 19 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 39, gap: 10, paddingVertical: 12 },
  loadingText: { color: colors.subText, flex: 1, fontSize: 12, lineHeight: 18 },
  errorCard: { marginLeft: 39, borderWidth: 1, borderColor: isDarkMode ? '#5C3F35' : '#E8C6BC', backgroundColor: isDarkMode ? '#241A17' : '#FFF5F1', padding: 14, borderRadius: 16, marginBottom: 8 },
  errorHeading: { flexDirection: 'row', gap: 7, alignItems: 'center', marginBottom: 8 },
  errorTitle: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '700' },
  errorText: { color: isDarkMode ? '#FFC5B4' : '#8E3220', fontSize: 13, lineHeight: 20 },
  retryButton: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', paddingTop: 13, paddingBottom: 3 },
  retryText: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  composerContainer: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background },
  composer: { flexDirection: 'row', alignItems: 'flex-end', borderRadius: 21, borderWidth: 1, borderColor: colors.border, backgroundColor: isDarkMode ? '#191919' : '#FFFFFF', padding: 7, paddingLeft: 15 },
  input: { flex: 1, color: colors.text, fontSize: 14, lineHeight: 21, minHeight: 40, maxHeight: 120, paddingTop: 10, paddingBottom: 9 },
  sendButton: { height: 40, width: 40, borderRadius: 15, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.accent, marginLeft: 8 },
  sendIcon: { color: isDarkMode ? '#1A1A1A' : '#FFFFFF' },
  disabled: { opacity: 0.4 },
  composerHint: { color: colors.subText, fontSize: 9, lineHeight: 15, paddingTop: 7, textAlign: 'center' },
  productCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, overflow: 'hidden', marginTop: 12, backgroundColor: isDarkMode ? '#181818' : '#FFFFFF' },
  productImage: { height: 140, width: '100%', backgroundColor: isDarkMode ? '#242424' : '#F0F1F3', resizeMode: 'cover' },
  imageFallback: { alignItems: 'center', justifyContent: 'center' },
  productBody: { padding: 14 },
  productName: { color: colors.text, fontWeight: '700', fontSize: 15, lineHeight: 21 },
  productPrice: { color: colors.accent, fontWeight: '700', fontSize: 16, marginTop: 7 },
  productDescription: { color: colors.subText, fontSize: 12, lineHeight: 19, marginTop: 7 },
  detailButton: { marginTop: 12, paddingTop: 11, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detailButtonText: { color: colors.accent, fontWeight: '700', fontSize: 12 },
});

export default ChatScreen;
