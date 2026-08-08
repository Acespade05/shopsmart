import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [cart, setCart] = useState({ items: [] });
  const { user } = useAuth();

  const refreshCart = useCallback(async () => {
    const res = await api.get('/cart');
    setCart(res.data.cart);
  }, []);

  useEffect(() => {
    refreshCart();
  }, [user, refreshCart]);

  async function addItem(productId, quantity = 1) {
    const res = await api.post('/cart/add', { productId, quantity });
    setCart(res.data.cart);
  }

  async function updateItem(productId, quantity) {
    const res = await api.put('/cart/update', { productId, quantity });
    setCart(res.data.cart);
  }

  async function removeItem(productId) {
    const res = await api.delete(`/cart/remove/${productId}`);
    setCart(res.data.cart);
  }

  async function clearCart() {
    const res = await api.delete('/cart/clear');
    setCart(res.data.cart);
  }

  const itemCount = cart.items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <CartContext.Provider
      value={{ cart, itemCount, subtotal, addItem, updateItem, removeItem, clearCart, refreshCart }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}