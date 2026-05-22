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
    clearCart: (state) => {
      state.items = [];
      state.subtotal = '0';
    },
  },
});

export const { setCart, clearCart } = cartSlice.actions;
export default cartSlice.reducer;
