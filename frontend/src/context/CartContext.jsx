import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [cart, setCart] = useState({ items: [] });
  const [loaded, setLoaded] = useState(false); // false until the first /cart response
  const { user } = useAuth();

  const refreshCart = useCallback(async () => {
    try {
      const res = await api.get('/cart');
      setCart(res.data.cart);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    refreshCart();
  }, [user, refreshCart]);

  // `size` is only passed for products that have sizes (clothing, footwear).
  async function addItem(productId, quantity = 1, size) {
    const res = await api.post('/cart/add', { productId, quantity, ...(size ? { size } : {}) });
    setCart(res.data.cart);
  }

  async function updateItem(productId, quantity, size) {
    const res = await api.put('/cart/update', { productId, quantity, ...(size ? { size } : {}) });
    setCart(res.data.cart);
  }

  async function removeItem(productId, size) {
    const res = await api.delete(`/cart/remove/${productId}`, size ? { params: { size } } : undefined);
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
      value={{ cart, loaded, itemCount, subtotal, addItem, updateItem, removeItem, clearCart, refreshCart }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}