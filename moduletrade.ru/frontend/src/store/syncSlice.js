// frontend/src/store/syncSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { syncAPI, marketplacesAPI, suppliersAPI } from '../services/api';

// Async thunks
export const syncStock = createAsyncThunk(
  'sync/syncStock',
  async (data, { rejectWithValue }) => {
    try {
      const response = await syncAPI.syncStock(data);
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Ошибка синхронизации остатков'
      );
    }
  }
);

export const syncOrders = createAsyncThunk(
  'sync/syncOrders',
  async (data, { rejectWithValue }) => {
    try {
      const response = await syncAPI.syncOrders(data);
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Ошибка синхронизации заказов'
      );
    }
  }
);

export const fetchSyncLogs = createAsyncThunk(
  'sync/fetchSyncLogs',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await syncAPI.getSyncLogs(params);
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Ошибка загрузки логов синхронизации'
      );
    }
  }
);

export const fetchSyncStatus = createAsyncThunk(
  'sync/fetchSyncStatus',
  async (_, { rejectWithValue }) => {
    try {
      const response = await syncAPI.getSyncStatus();
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Ошибка загрузки статуса синхронизации'
      );
    }
  }
);

export const fetchMarketplaces = createAsyncThunk(
  'sync/fetchMarketplaces',
  async (_, { rejectWithValue }) => {
    try {
      const response = await marketplacesAPI.getMarketplaces();
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Ошибка загрузки маркетплейсов'
      );
    }
  }
);

export const fetchSuppliers = createAsyncThunk(
  'sync/fetchSuppliers',
  async (_, { rejectWithValue }) => {
    try {
      const response = await suppliersAPI.getSuppliers();
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Ошибка загрузки поставщиков'
      );
    }
  }
);

export const testMarketplaceConnection = createAsyncThunk(
  'sync/testMarketplaceConnection',
  async (id, { rejectWithValue }) => {
    try {
      const response = await marketplacesAPI.testMarketplaceConnection(id);
      return { id, result: response.data };
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Ошибка тестирования подключения'
      );
    }
  }
);

export const testSupplierConnection = createAsyncThunk(
  'sync/testSupplierConnection',
  async (id, { rejectWithValue }) => {
    try {
      const response = await suppliersAPI.testSupplierConnection(id);
      return { id, result: response.data };
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Ошибка тестирования подключения'
      );
    }
  }
);

export const importFromSupplier = createAsyncThunk(
  'sync/importFromSupplier',
  async ({ id, params }, { rejectWithValue }) => {
    try {
      const response = await suppliersAPI.importFromSupplier(id, params);
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Ошибка импорта от поставщика'
      );
    }
  }
);

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

const syncSlice = createSlice({
  name: 'sync',
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
    clearTestResults: (state) => {
      state.testing = {};
    },
    setTesting: (state, action) => {
      const { id, loading } = action.payload;
      state.testing[id] = loading;
    },
    setImporting: (state, action) => {
      const { id, loading } = action.payload;
      state.importing[id] = loading;
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
        state.logs = action.payload.items || action.payload;
      })
      .addCase(fetchSyncLogs.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Fetch sync status
      .addCase(fetchSyncStatus.fulfilled, (state, action) => {
        state.status = action.payload;
      })
      .addCase(fetchSyncStatus.rejected, (state, action) => {
        state.error = action.payload;
      })
      
      // Fetch marketplaces
      .addCase(fetchMarketplaces.fulfilled, (state, action) => {
        state.marketplaces = action.payload;
      })
      .addCase(fetchMarketplaces.rejected, (state, action) => {
        state.error = action.payload;
      })
      
      // Fetch suppliers
      .addCase(fetchSuppliers.fulfilled, (state, action) => {
        state.suppliers = action.payload;
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

export const {
  setFilters,
  resetFilters,
  clearError,
  clearTestResults,
  setTesting,
  setImporting
} = syncSlice.actions;

export default syncSlice.reducer;