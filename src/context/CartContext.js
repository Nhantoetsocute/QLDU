import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CartContext = createContext(null);

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState([]);
  const isLoaded = React.useRef(false);

  useEffect(() => {
    const loadCart = async () => {
      try {
        const storedCart = await AsyncStorage.getItem('@cart');
        if (storedCart) {
          setCartItems(JSON.parse(storedCart));
        }
      } catch (e) {
        console.error("Lỗi khi load giỏ hàng:", e);
      } finally {
        isLoaded.current = true;
      }
    };
    loadCart();
  }, []);

  useEffect(() => {
    if (!isLoaded.current) return; // Không ghi đè khi chưa load xong
    const saveCart = async () => {
      try {
        await AsyncStorage.setItem('@cart', JSON.stringify(cartItems));
      } catch (e) {
        console.error("Lỗi khi lưu giỏ hàng:", e);
      }
    };
    saveCart();
  }, [cartItems]);

  const addToCart = (newItem) => {
    setCartItems(prev => {
      const existing = prev.find(item => item.id === newItem.id || item.name === newItem.name);
      if (existing) {
        return prev.map(item => 
          (item.id === newItem.id || item.name === newItem.name)
            ? { ...item, quantity: item.quantity + (newItem.quantity || 1) } 
            : item
        );
      }
      return [{ ...newItem, id: newItem.id || `cart-${Date.now()}` }, ...prev];
    });
  };

  const updateQuantity = (id, delta) => {
    setCartItems(prev => prev.map(item => {
      if (item.id === id) {
         return { ...item, quantity: Math.max(1, item.quantity + delta) };
      }
      return item;
    }));
  };

  const removeItem = (id) => {
    setCartItems(prev => prev.filter(item => item.id !== id));
  };
  
  const clearCart = () => {
      setCartItems([]);
      AsyncStorage.removeItem('@cart');
  };

  return (
    <CartContext.Provider value={{ cartItems, addToCart, updateQuantity, removeItem, clearCart, setCartItems }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
};
