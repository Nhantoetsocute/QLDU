import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUserProfile } from './UserProfileContext';
import { subscribePrivacyReset, normalizeCart } from '../services/privacyStorage';

const CartContext = createContext(null);

export const CartProvider = ({ children }) => {
  const { profile, token } = useUserProfile();
  const [cartItems, setCartItems] = useState([]);
  const activeKey = useRef(null);
  activeKey.current = token && profile?.id ? `session:${profile.id}` : null;

  useEffect(() => subscribePrivacyReset(() => {activeKey.current=null;setCartItems([]);}), []);
  useEffect(() => {
    setCartItems([]);
    // Remove legacy preference caches; carts now exist only for the current in-memory session.
    let mounted=true;
    (async()=>{
      try {
        const keys=await AsyncStorage.getAllKeys();
        const old=keys.filter(key=>key==='@cart' || key.startsWith('@cart:'));
        if(old.length) await AsyncStorage.multiRemove(old);
      } catch {if(mounted)setCartItems([]);}
    })();
    return ()=>{mounted=false;};
  }, [token,profile?.id]);

  const addToCart = (newItem) => {
    const item = normalizeCart([{ ...newItem, quantity: newItem.quantity || 1 }])[0];
    if (!item || !activeKey.current) return;
    setCartItems((previous) => {
      const existing = previous.find((entry) => entry.productId === item.productId);
      return existing ? previous.map((entry) => entry.productId === item.productId
        ? { ...entry, quantity: Math.min(99, entry.quantity + item.quantity) } : entry)
        : [item, ...previous].slice(0, 50);
    });
  };

  const updateQuantity = (id, delta) => {
    setCartItems((previous) => previous.map((item) => String(item.id) === String(id)
      ? { ...item, quantity: Math.min(99, Math.max(1, item.quantity + delta)) } : item));
  };
  const removeItem = (id) => setCartItems((previous) => previous.filter((item) => String(item.id) !== String(id)));
  const clearCart = useCallback(() => setCartItems([]), []);

  return (
    <CartContext.Provider value={{ cartItems, addToCart, updateQuantity, removeItem, clearCart, setCartItems }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
};
