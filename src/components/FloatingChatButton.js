import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Keyboard, PanResponder, Platform, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../theme/ThemeContext';

const BUTTON_SIZE = 56;
const EDGE_MARGIN = 8;
const DRAG_THRESHOLD = 6;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const FloatingChatButton = ({ onPress, visible = true }) => {
  const { colors, isDarkMode } = useAppTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(() => Keyboard.isVisible?.() || false);
  const [isDragging, setIsDragging] = useState(false);
  const bounds = {
    minX: insets.left + EDGE_MARGIN,
    maxX: Math.max(insets.left + EDGE_MARGIN, width - insets.right - BUTTON_SIZE - EDGE_MARGIN),
    minY: insets.top + EDGE_MARGIN,
    maxY: Math.max(insets.top + EDGE_MARGIN, height - insets.bottom - BUTTON_SIZE - EDGE_MARGIN),
  };
  const boundsRef = useRef(bounds);
  boundsRef.current = bounds;
  const initialPosition = {
    x: clamp(12, bounds.minX, bounds.maxX),
    y: clamp((height - BUTTON_SIZE) / 2, bounds.minY, bounds.maxY),
  };
  const locationRef = useRef(initialPosition);
  const gestureStartRef = useRef(initialPosition);
  const movedRef = useRef(false);
  const multiTouchRef = useRef(false);
  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;
  const positionRef = useRef(null);
  if (!positionRef.current) positionRef.current = new Animated.ValueXY(initialPosition);

  const panResponder = useMemo(() => {
    const updatePosition = ({ dx, dy }) => {
      const limits = boundsRef.current;
      const next = {
        x: clamp(gestureStartRef.current.x + dx, limits.minX, limits.maxX),
        y: clamp(gestureStartRef.current.y + dy, limits.minY, limits.maxY),
      };
      locationRef.current = next;
      positionRef.current.setValue(next);
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (_, gesture) => {
        gestureStartRef.current = { ...locationRef.current };
        multiTouchRef.current = gesture.numberActiveTouches > 1;
        movedRef.current = multiTouchRef.current;
      },
      onPanResponderStart: (_, gesture) => {
        if (gesture.numberActiveTouches > 1) {
          multiTouchRef.current = true;
          movedRef.current = true;
        }
      },
      onPanResponderMove: (_, gesture) => {
        if (gesture.numberActiveTouches > 1 || multiTouchRef.current) {
          multiTouchRef.current = true;
          movedRef.current = true;
          return;
        }
        if (!movedRef.current && Math.hypot(gesture.dx, gesture.dy) > DRAG_THRESHOLD) {
          movedRef.current = true;
          setIsDragging(true);
        }
        if (movedRef.current) updatePosition(gesture);
      },
      onPanResponderRelease: (_, gesture) => {
        const wasMoved = movedRef.current || Math.hypot(gesture.dx, gesture.dy) > DRAG_THRESHOLD;
        if (wasMoved && !multiTouchRef.current) updatePosition(gesture);
        setIsDragging(false);
        if (!wasMoved) onPressRef.current?.();
      },
      onPanResponderTerminate: () => { setIsDragging(false); },
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
    });
  }, []);

  // Keep the button reachable after rotating/resizing the phone.
  useEffect(() => {
    const limits = boundsRef.current;
    const next = {
      x: clamp(locationRef.current.x, limits.minX, limits.maxX),
      y: clamp(locationRef.current.y, limits.minY, limits.maxY),
    };
    locationRef.current = next;
    gestureStartRef.current = next;
    positionRef.current.setValue(next);
  }, [width, height, insets.top, insets.right, insets.bottom, insets.left]);

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  if (!visible || keyboardVisible) return null;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[styles.button, {
        backgroundColor: colors.accent,
        borderColor: colors.background,
        shadowColor: colors.accent,
        opacity: isDragging ? 0.85 : 1,
        transform: positionRef.current.getTranslateTransform(),
      }]}
      accessible
      accessibilityRole="button"
      accessibilityLabel="Mở trợ lý AI True Juice"
      accessibilityHint="Chạm để mở chat. Kéo để di chuyển biểu tượng trên màn hình"
      onAccessibilityTap={onPress}
      accessibilityActions={[{ name: 'activate', label: 'Mở trợ lý AI True Juice' }]}
      onAccessibilityAction={({ nativeEvent }) => {
        if (nativeEvent.actionName === 'activate') onPressRef.current?.();
      }}
      testID="floating-chat-button"
    >
      <Ionicons name="chatbubbles-outline" size={27} color={isDarkMode ? '#1A1A1A' : '#FFFFFF'} />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: 28,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    elevation: 10,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
});

export default FloatingChatButton;
