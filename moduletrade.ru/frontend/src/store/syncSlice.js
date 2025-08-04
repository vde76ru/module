// ===================================================
// ФАЙЛ: frontend/src/store/syncSlice.js  
// ✅ ИСПРАВЛЕНО: Правильные импорты из новой API архитектуры
// ===================================================
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { api } from '../services'; // ✅ ИСПРАВЛЕНО: Импорт из правильного места

// =====================================
// ASYNC THUNKS  
// =====================================

export const syncStock = createAsyncThunk(
  'sync/syncStock',
  async (data, { rejectWithValue }) => {
    try {
      const response = await api.sync.syncStock(data);
      return response;
    } catch (error) {
      return rejectWithValue({
        message: error.message || 'Ошибка синхронизации остатков',
        status: error.status
      });
    }
  }
);

export const syncOrders = createAsyncThunk(
  'sync/syncOrders',
  async (data, { rejectWithValue }) => {
    try {
      const response = await api.sync.syncOrders(data);
      return response;
    } catch (error) {
      return rejectWithValue({
        message: error.message || 'Ошибка синхронизации заказов',
        status: error.status
      });
    }
  }
);

export const fetchSyncLogs = createAsyncThunk(
  'sync/fetchSyncLogs',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await api.sync.getSyncLogs(params);
      return response;
    } catch (error) {
      return rejectWithValue({
        message: error.message || 'Ошибка загрузки логов синхронизации',
        status: error.status
      });
    }
  }
);

export const fetchSyncStatus = createAsyncThunk(
  'sync/fetchSyncStatus',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.sync.getSyncStatus();
      return response;
    } catch (error) {
      return rejectWithValue({
        message: error.message || 'Ошибка загрузки статуса синхронизации',
        status: error.status
      });
    }
  }
);

export const fetchMarketplaces = createAsyncThunk(
  'sync/fetchMarketplaces',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.marketplaces.getMarketplaces();
      return response;
    } catch (error) {
      return rejectWithValue({
        message: error.message || 'Ошибка загрузки маркетплейсов',
        status: error.status
      });
    }
  }
);

export const fetchSuppliers = createAsyncThunk(
  'sync/fetchSuppliers',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.suppliers.getSuppliers();
      return response;
    } catch (error) {
      return rejectWithValue({
        message: error.message || 'Ошибка загрузки поставщиков',
        status: error.status
      });
    }
  }
);

export const testMarketplaceConnection = createAsyncThunk(
  'sync/testMarketplaceConnection',
  async (id, { rejectWithValue }) => {
    try {
      const response = await api.marketplaces.testMarketplaceConnection(id);
      return { id, result: response };
    } catch (error) {
      return rejectWithValue({
        message: error.message || 'Ошибка тестирования подключения',
        status: error.status
      });
    }
  }
);

export const testSupplierConnection = createAsyncThunk(
  'sync/testSupplierConnection',
  async (id, { rejectWithValue }) => {
    try {
      const response = await api.suppliers.testSupplierConnection(id);
      return { id, result: response };
    } catch (error) {
      return rejectWithValue({
        message: error.message || 'Ошибка тестирования подключения',
        status: error.status
      });
    }
  }
);

export const importFromSupplier = createAsyncThunk(
  'sync/importFromSupplier',
  async ({ id, params }, { rejectWithValue }) => {
    try {
      const response = await api.suppliers.importFromSupplier(id, params);
      return response;
    } catch (error) {
      return rejectWithValue({
        message: error.message || 'Ошибка импорта от поставщика',
        status: error.status
      });
    }
  }
);

// =====================================
// INITIAL STATE
// =====================================

const initialState = {
  logs: [],
  marketplaces: [],
  suppliers: [],
  status: {
    active_syncs: 0,
    last_sync: null,
    total_syncs_today: 0,
    errors_today: 0
  },
  loading: false,
  syncing: false,
  testing: {},
  importing: {},
  error: null,
  filters: {
    sync_type: '',
    status: '',
    date_from: null,
    date_to: null,
    limit: 50,
    offset: 0
  }
};

// =====================================
// SLICE
// =====================================

const syncSlice = createSlice({
  name: 'sync',
  initialState,
  reducers: {
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    resetFilters: (state) => {
      state.filters = { ...initialState.filters };
    },
    clearError: (state) => {
      state.error = null;
    },
    clearTestResults: (state) => {
      state.testing = {};
    },
    setTesting: (state, action) => {
      const { id, value } = action.payload;
      state.testing[id] = value;
    },
    setImporting: (state, action) => {
      const { id, value } = action.payload;
      state.importing[id] = value;
    },
  },
  extraReducers: (builder) => {
    builder
      // Sync stock
      .addCase(syncStock.pending, (state) => {
        state.syncing = true;
        state.error = null;
      })
      .addCase(syncStock.fulfilled, (state) => {
        state.syncing = false;
      })
      .addCase(syncStock.rejected, (state, action) => {
        state.syncing = false;
        state.error = action.payload;
      })
      
      // Sync orders
      .addCase(syncOrders.pending, (state) => {
        state.syncing = true;
        state.error = null;
      })
      .addCase(syncOrders.fulfilled, (state) => {
        state.syncing = false;
      })
      .addCase(syncOrders.rejected, (state, action) => {
        state.syncing = false;
        state.error = action.payload;
      })
      
      // Fetch sync logs
      .addCase(fetchSyncLogs.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSyncLogs.fulfilled, (state, action) => {
        state.loading = false;
        state.logs = action.payload.logs || action.payload.data || [];
      })
      .addCase(fetchSyncLogs.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Fetch sync status
      .addCase(fetchSyncStatus.fulfilled, (state, action) => {
        state.status = action.payload.status || action.payload;
      })
      .addCase(fetchSyncStatus.rejected, (state, action) => {
        state.error = action.payload;
      })
      
      // Fetch marketplaces
      .addCase(fetchMarketplaces.fulfilled, (state, action) => {
        state.marketplaces = action.payload.marketplaces || action.payload.data || [];
      })
      .addCase(fetchMarketplaces.rejected, (state, action) => {
        state.error = action.payload;
      })
      
      // Fetch suppliers
      .addCase(fetchSuppliers.fulfilled, (state, action) => {
        state.suppliers = action.payload.suppliers || action.payload.data || [];
      })
      .addCase(fetchSuppliers.rejected, (state, action) => {
        state.error = action.payload;
      })
      
      // Test marketplace connection
      .addCase(testMarketplaceConnection.pending, (state, action) => {
        state.testing[action.meta.arg] = true;
      })
      .addCase(testMarketplaceConnection.fulfilled, (state, action) => {
        state.testing[action.payload.id] = false;
      })
      .addCase(testMarketplaceConnection.rejected, (state, action) => {
        state.testing[action.meta.arg] = false;
        state.error = action.payload;
      })
      
      // Test supplier connection
      .addCase(testSupplierConnection.pending, (state, action) => {
        state.testing[action.meta.arg] = true;
      })
      .addCase(testSupplierConnection.fulfilled, (state, action) => {
        state.testing[action.payload.id] = false;
      })
      .addCase(testSupplierConnection.rejected, (state, action) => {
        state.testing[action.meta.arg] = false;
        state.error = action.payload;
      })
      
      // Import from supplier
      .addCase(importFromSupplier.pending, (state, action) => {
        state.importing[action.meta.arg.id] = true;
        state.error = null;
      })
      .addCase(importFromSupplier.fulfilled, (state, action) => {
        state.importing[action.meta.arg.id] = false;
      })
      .addCase(importFromSupplier.rejected, (state, action) => {
        state.importing[action.meta.arg.id] = false;
        state.error = action.payload;
      });
  },
});

// =====================================
// EXPORTS
// =====================================

export const {
  setFilters,
  resetFilters,
  clearError,
  clearTestResults,
  setTesting,
  setImporting
} = syncSlice.actions;

export default syncSlice.reducer;