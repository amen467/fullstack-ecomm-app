import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { CartItem, CartResponse } from '../../api/client';

interface CartState {
  items: CartItem[];
  subtotal: string;
}

const initialState: CartState = {
  items: [],
  subtotal: '0',
};

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    setCart: (state, action: PayloadAction<CartResponse>) => {
      state.items = action.payload.items;
      state.subtotal = action.payload.subtotal;
    },
    removeItem: (state, action: PayloadAction<number>) => {
      state.items = state.items.filter(item => item.id !== action.payload);
      state.subtotal = calculateSubtotal(state.items);
    },
    updateQuantity: (state, action: PayloadAction<{ id: number; quantity: number }>) => {
      const item = state.items.find(item => item.id === action.payload.id);
      if (item) {
        item.quantity = action.payload.quantity;
        item.lineTotal = calculateLineTotal(item.product.price, action.payload.quantity);
        state.subtotal = calculateSubtotal(state.items);
      }
    },
    clearCart: (state) => {
      state.items = [];
      state.subtotal = '0';
    },
  },
});

function calculateLineTotal(price: string, quantity: number) {
  return (Number(price) * quantity).toString();
}

function calculateSubtotal(items: CartItem[]) {
  return items
    .reduce((total, item) => total + Number(item.lineTotal), 0)
    .toString();
}

export const { setCart, removeItem, updateQuantity, clearCart } = cartSlice.actions;
export default cartSlice.reducer;
