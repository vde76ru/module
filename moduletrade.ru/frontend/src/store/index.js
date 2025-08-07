// ===================================================
// ФАЙЛ: frontend/src/store/index.js
// ИСПРАВЛЕННАЯ ВЕРСИЯ: Правильные импорты
// ===================================================
import { configureStore } from '@reduxjs/toolkit';
import authSlice from './authSlice';
import productsSlice from './productsSlice';
import warehousesSlice from './warehousesSlice';
import syncSlice from './syncSlice';

export const store = configureStore({
  reducer: {
    auth: authSlice,
    products: productsSlice,
    warehouses: warehousesSlice,
    sync: syncSlice,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST'],
      },
    }),
});

// TypeScript types (для использования в TypeScript файлах):
// export type RootState = ReturnType<typeof store.getState>;
// export type AppDispatch = typeof store.dispatch;