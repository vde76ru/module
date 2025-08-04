// ===================================================
// ФАЙЛ: frontend/src/store/productsSlice.js
// ✅ ИСПРАВЛЕНО: Правильные импорты из новой API архитектуры  
// ===================================================
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { api } from '../services'; // ✅ ИСПРАВЛЕНО: Импорт из правильного места

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

const productsSlice = createSlice({
  name: 'products',
  initialState,
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
  extraReducers: (builder) => {
    builder
      // Fetch products
      .addCase(fetchProducts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProducts.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.items || action.payload.data || [];
        state.total = action.payload.total || action.payload.items?.length || 0;
      })
      .addCase(fetchProducts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.items = [];
        state.total = 0;
      })
      
      // Create product
      .addCase(createProduct.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createProduct.fulfilled, (state, action) => {
        state.loading = false;
        state.items.unshift(action.payload);
        state.total += 1;
      })
      .addCase(createProduct.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Update product
      .addCase(updateProduct.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateProduct.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.items.findIndex(item => item.id === action.payload.id);
        if (index !== -1) {
          state.items[index] = action.payload;
        }
      })
      .addCase(updateProduct.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Delete product
      .addCase(deleteProduct.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteProduct.fulfilled, (state, action) => {
        state.loading = false;
        state.items = state.items.filter(item => item.id !== action.payload);
        state.total -= 1;
      })
      .addCase(deleteProduct.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Import products
      .addCase(importProducts.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.importStatus = 'pending';
      })
      .addCase(importProducts.fulfilled, (state, action) => {
        state.loading = false;
        state.importStatus = 'completed';
        // Если импорт возвращает новые товары, добавляем их
        if (action.payload.products) {
          state.items = [...action.payload.products, ...state.items];
          state.total += action.payload.products.length;
        }
      })
      .addCase(importProducts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.importStatus = 'failed';
      })
      
      // Bulk update products
      .addCase(bulkUpdateProducts.pending, (state) => {
        state.bulkActionLoading = true;
        state.error = null;
      })
      .addCase(bulkUpdateProducts.fulfilled, (state, action) => {
        state.bulkActionLoading = false;
        // Обновляем товары в списке
        if (action.payload.updated_products) {
          action.payload.updated_products.forEach(updatedProduct => {
            const index = state.items.findIndex(item => item.id === updatedProduct.id);
            if (index !== -1) {
              state.items[index] = updatedProduct;
            }
          });
        }
      })
      .addCase(bulkUpdateProducts.rejected, (state, action) => {
        state.bulkActionLoading = false;
        state.error = action.payload;
      })
      
      // Bulk delete products
      .addCase(bulkDeleteProducts.pending, (state) => {
        state.bulkActionLoading = true;
        state.error = null;
      })
      .addCase(bulkDeleteProducts.fulfilled, (state, action) => {
        state.bulkActionLoading = false;
        // Удаляем товары из списка
        if (action.payload.deleted_ids) {
          state.items = state.items.filter(item => 
            !action.payload.deleted_ids.includes(item.id)
          );
          state.total -= action.payload.deleted_ids.length;
        }
      })
      .addCase(bulkDeleteProducts.rejected, (state, action) => {
        state.bulkActionLoading = false;
        state.error = action.payload;
      })
      
      // Export products
      .addCase(exportProducts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(exportProducts.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(exportProducts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
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