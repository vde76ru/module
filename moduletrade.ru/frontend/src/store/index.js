// frontend/src/store/index.js
import { configureStore } from '@reduxjs/toolkit';
import authSlice from './authSlice';
import productsSlice from './productsSlice';
import warehousesSlice from './warehousesSlice';

export const store = configureStore({
  reducer: {
    auth: authSlice,
    products: productsSlice,
    warehouses: warehousesSlice,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST'],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;