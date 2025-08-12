// ===================================================
// ФАЙЛ: frontend/src/store/productsSlice.js
// ✅ ИСПРАВЛЕНО: Правильные импорты из новой API архитектуры
// ===================================================
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { createAsyncSlice } from './helpers/asyncHelpers';
import { api } from 'services'; // ✅ ИСПРАВЛЕНО: Импорт из правильного места

// =====================================
// ASYNC THUNKS
// =====================================

export const fetchProducts = createAsyncThunk(
  'products/fetchProducts',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await api.products.getProducts(params);
      return response;
    } catch (error) {
      return rejectWithValue({
        message: error.message || 'Ошибка загрузки товаров',
        status: error.status
      });
    }
  }
);

export const createProduct = createAsyncThunk(
  'products/createProduct',
  async (productData, { rejectWithValue }) => {
    try {
      const response = await api.products.createProduct(productData);
      return response;
    } catch (error) {
      return rejectWithValue({
        message: error.message || 'Ошибка создания товара',
        status: error.status
      });
    }
  }
);

export const updateProduct = createAsyncThunk(
  'products/updateProduct',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await api.products.updateProduct(id, data);
      return response;
    } catch (error) {
      return rejectWithValue({
        message: error.message || 'Ошибка обновления товара',
        status: error.status
      });
    }
  }
);

export const deleteProduct = createAsyncThunk(
  'products/deleteProduct',
  async (id, { rejectWithValue }) => {
    try {
      await api.products.deleteProduct(id);
      return id;
    } catch (error) {
      return rejectWithValue({
        message: error.message || 'Ошибка удаления товара',
        status: error.status
      });
    }
  }
);

export const importProducts = createAsyncThunk(
  'products/importProducts',
  async (file, { rejectWithValue }) => {
    try {
      const response = await api.products.importProducts(file);
      return response;
    } catch (error) {
      return rejectWithValue({
        message: error.message || 'Ошибка импорта товаров',
        status: error.status
      });
    }
  }
);

export const bulkUpdateProducts = createAsyncThunk(
  'products/bulkUpdateProducts',
  async ({ productIds, updates }, { rejectWithValue }) => {
    try {
      const response = await api.products.bulkUpdateProducts(productIds, updates);
      return response;
    } catch (error) {
      return rejectWithValue({
        message: error.message || 'Ошибка массового обновления товаров',
        status: error.status
      });
    }
  }
);

export const bulkDeleteProducts = createAsyncThunk(
  'products/bulkDeleteProducts',
  async (productIds, { rejectWithValue }) => {
    try {
      const response = await api.products.bulkDeleteProducts(productIds);
      return response;
    } catch (error) {
      return rejectWithValue({
        message: error.message || 'Ошибка массового удаления товаров',
        status: error.status
      });
    }
  }
);

export const exportProducts = createAsyncThunk(
  'products/exportProducts',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await api.products.exportProducts(params);
      return response;
    } catch (error) {
      return rejectWithValue({
        message: error.message || 'Ошибка экспорта товаров',
        status: error.status
      });
    }
  }
);

// =====================================
// INITIAL STATE
// =====================================

const initialState = {
  items: [],
  total: 0,
  loading: false,
  error: null,
  filters: {
    search: '',
    source_type: 'all',
    category_id: null,
    brand_id: null,
    is_active: null,
    limit: 50,
    offset: 0,
  },
  selectedProduct: null,
  importStatus: null,
  bulkActionLoading: false,
};

// =====================================
// SLICE
// =====================================

// Настройка специфичных обработчиков для отдельных thunks
const thunkConfigs = new Map([
  [bulkUpdateProducts, {
    setLoading: false,
    onPending: (state) => { state.bulkActionLoading = true; },
    onFulfilled: (state) => { state.bulkActionLoading = false; },
    onRejected: (state) => { state.bulkActionLoading = false; },
  }],
  [bulkDeleteProducts, {
    setLoading: false,
    onPending: (state) => { state.bulkActionLoading = true; },
    onFulfilled: (state) => { state.bulkActionLoading = false; },
    onRejected: (state) => { state.bulkActionLoading = false; },
  }],
  [importProducts, {
    onPending: (state) => { state.importStatus = 'pending'; },
  }],
]);

const productsSlice = createAsyncSlice({
  name: 'products',
  initialState,
  thunks: [
    fetchProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    importProducts,
    bulkUpdateProducts,
    bulkDeleteProducts,
    exportProducts,
  ],
  options: {
    dataField: 'items',
    dataThunks: [fetchProducts],
    dataProcessor: (_state, action) => action.payload.items || action.payload.data || [],
    onFulfilled: (state, action) => {
      // Специфичная логика: total, import status, bulk flags
      switch (action.type) {
        case fetchProducts.fulfilled.type: {
          state.total = action.payload.total || action.payload.items?.length || 0;
          break;
        }
        case createProduct.fulfilled.type: {
          state.items.unshift(action.payload);
          state.total += 1;
          break;
        }
        case updateProduct.fulfilled.type: {
          const index = state.items.findIndex((item) => item.id === action.payload.id);
          if (index !== -1) {
            state.items[index] = action.payload;
          }
          break;
        }
        case deleteProduct.fulfilled.type: {
          state.items = state.items.filter((item) => item.id !== action.payload);
          state.total -= 1;
          break;
        }
        case importProducts.fulfilled.type: {
          state.importStatus = 'completed';
          if (action.payload.products) {
            state.items = [...action.payload.products, ...state.items];
            state.total += action.payload.products.length;
          }
          break;
        }
        case bulkUpdateProducts.fulfilled.type: {
          if (action.payload.updated_products) {
            action.payload.updated_products.forEach((updatedProduct) => {
              const index = state.items.findIndex((item) => item.id === updatedProduct.id);
              if (index !== -1) {
                state.items[index] = updatedProduct;
              }
            });
          }
          break;
        }
        case bulkDeleteProducts.fulfilled.type: {
          if (action.payload.deleted_ids) {
            state.items = state.items.filter((item) => !action.payload.deleted_ids.includes(item.id));
            state.total -= action.payload.deleted_ids.length;
          }
          break;
        }
        case exportProducts.fulfilled.type: {
          // nothing extra
          break;
        }
        default:
          break;
      }
    },
    onRejected: (state, action) => {
      switch (action.type) {
        case importProducts.rejected.type:
          state.importStatus = 'failed';
          break;
        default:
          break;
      }
    },
  },
  thunkConfigs,
  reducers: {
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearFilters: (state) => {
      state.filters = { ...initialState.filters };
    },
    setSelectedProduct: (state, action) => {
      state.selectedProduct = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
    clearImportStatus: (state) => {
      state.importStatus = null;
    },
  },
});

// =====================================
// EXPORTS
// =====================================

export const {
  setFilters,
  clearFilters,
  setSelectedProduct,
  clearError,
  clearImportStatus,
} = productsSlice.actions;

export default productsSlice.reducer;