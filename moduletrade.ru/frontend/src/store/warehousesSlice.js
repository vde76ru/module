// frontend/src/store/warehousesSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { warehousesAPI } from '../services/api';

// Async thunks
export const fetchWarehouses = createAsyncThunk(
  'warehouses/fetchWarehouses',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await warehousesAPI.getWarehouses(params);
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Ошибка загрузки складов'
      );
    }
  }
);

export const fetchWarehouse = createAsyncThunk(
  'warehouses/fetchWarehouse',
  async (id, { rejectWithValue }) => {
    try {
      const response = await warehousesAPI.getWarehouse(id);
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Ошибка загрузки склада'
      );
    }
  }
);

export const createWarehouse = createAsyncThunk(
  'warehouses/createWarehouse',
  async (warehouseData, { rejectWithValue }) => {
    try {
      const response = await warehousesAPI.createWarehouse(warehouseData);
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Ошибка создания склада'
      );
    }
  }
);

export const updateWarehouse = createAsyncThunk(
  'warehouses/updateWarehouse',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await warehousesAPI.updateWarehouse(id, data);
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Ошибка обновления склада'
      );
    }
  }
);

export const deleteWarehouse = createAsyncThunk(
  'warehouses/deleteWarehouse',
  async (id, { rejectWithValue }) => {
    try {
      await warehousesAPI.deleteWarehouse(id);
      return id;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Ошибка удаления склада'
      );
    }
  }
);

export const transferProduct = createAsyncThunk(
  'warehouses/transferProduct',
  async (transferData, { rejectWithValue }) => {
    try {
      const response = await warehousesAPI.transferProduct(transferData);
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Ошибка перемещения товара'
      );
    }
  }
);

export const fetchWarehouseStock = createAsyncThunk(
  'warehouses/fetchWarehouseStock',
  async ({ warehouseId, params = {} }, { rejectWithValue }) => {
    try {
      const response = await warehousesAPI.getStock(warehouseId, params);
      return { warehouseId, stock: response.data };
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Ошибка загрузки остатков'
      );
    }
  }
);

const initialState = {
  items: [],
  currentWarehouse: null,
  stock: {},
  total: 0,
  loading: false,
  error: null,
  transferring: false,
  filters: {
    type: '',
    is_active: true,
    search: ''
  }
};

const warehousesSlice = createSlice({
  name: 'warehouses',
  initialState,
  reducers: {
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    resetFilters: (state) => {
      state.filters = initialState.filters;
    },
    clearError: (state) => {
      state.error = null;
    },
    clearCurrentWarehouse: (state) => {
      state.currentWarehouse = null;
    },
    clearStock: (state) => {
      state.stock = {};
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch warehouses
      .addCase(fetchWarehouses.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchWarehouses.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.items || action.payload;
        state.total = action.payload.total || action.payload.length || 0;
      })
      .addCase(fetchWarehouses.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Fetch single warehouse
      .addCase(fetchWarehouse.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchWarehouse.fulfilled, (state, action) => {
        state.loading = false;
        state.currentWarehouse = action.payload;
      })
      .addCase(fetchWarehouse.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Create warehouse
      .addCase(createWarehouse.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createWarehouse.fulfilled, (state, action) => {
        state.loading = false;
        state.items.unshift(action.payload);
        state.total += 1;
      })
      .addCase(createWarehouse.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Update warehouse
      .addCase(updateWarehouse.fulfilled, (state, action) => {
        const index = state.items.findIndex(item => item.id === action.payload.id);
        if (index !== -1) {
          state.items[index] = action.payload;
        }
        if (state.currentWarehouse?.id === action.payload.id) {
          state.currentWarehouse = action.payload;
        }
      })
      .addCase(updateWarehouse.rejected, (state, action) => {
        state.error = action.payload;
      })
      
      // Delete warehouse
      .addCase(deleteWarehouse.fulfilled, (state, action) => {
        state.items = state.items.filter(item => item.id !== action.payload);
        state.total -= 1;
        if (state.currentWarehouse?.id === action.payload) {
          state.currentWarehouse = null;
        }
      })
      .addCase(deleteWarehouse.rejected, (state, action) => {
        state.error = action.payload;
      })
      
      // Transfer product
      .addCase(transferProduct.pending, (state) => {
        state.transferring = true;
        state.error = null;
      })
      .addCase(transferProduct.fulfilled, (state) => {
        state.transferring = false;
      })
      .addCase(transferProduct.rejected, (state, action) => {
        state.transferring = false;
        state.error = action.payload;
      })
      
      // Fetch warehouse stock
      .addCase(fetchWarehouseStock.fulfilled, (state, action) => {
        const { warehouseId, stock } = action.payload;
        state.stock[warehouseId] = stock;
      })
      .addCase(fetchWarehouseStock.rejected, (state, action) => {
        state.error = action.payload;
      });
  },
});

export const {
  setFilters,
  resetFilters,
  clearError,
  clearCurrentWarehouse,
  clearStock
} = warehousesSlice.actions;

export default warehousesSlice.reducer;