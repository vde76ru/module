// ===================================================
// ФАЙЛ: frontend/src/store/syncSlice.js
// ✅ ИСПРАВЛЕНО: Правильные импорты из новой API архитектуры
// ===================================================
import { createAsyncThunk } from '@reduxjs/toolkit';
import { createAsyncSlice } from './helpers/asyncHelpers';
import { api } from 'services'; // ✅ ИСПРАВЛЕНО: Импорт из правильного места

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

// Настройки per-thunk для управления загрузкой/ошибками без дублирования
const thunkConfigs = new Map([
  [syncStock, {
    setLoading: false,
    onPending: (state) => { state.syncing = true; state.error = null; },
    onFulfilled: (state) => { state.syncing = false; },
    onRejected: (state, action) => { state.syncing = false; state.error = action.payload; },
  }],
  [syncOrders, {
    setLoading: false,
    onPending: (state) => { state.syncing = true; state.error = null; },
    onFulfilled: (state) => { state.syncing = false; },
    onRejected: (state, action) => { state.syncing = false; state.error = action.payload; },
  }],
  [fetchSyncStatus, { setLoading: false }],
  [fetchMarketplaces, { setLoading: false }],
  [fetchSuppliers, { setLoading: false }],
  [testMarketplaceConnection, {
    setLoading: false,
    onPending: (state, action) => { state.testing[action.meta.arg] = true; },
    onFulfilled: (state, action) => { state.testing[action.payload.id] = false; },
    onRejected: (state, action) => { state.testing[action.meta.arg] = false; state.error = action.payload; },
  }],
  [testSupplierConnection, {
    setLoading: false,
    onPending: (state, action) => { state.testing[action.meta.arg] = true; },
    onFulfilled: (state, action) => { state.testing[action.payload.id] = false; },
    onRejected: (state, action) => { state.testing[action.meta.arg] = false; state.error = action.payload; },
  }],
  [importFromSupplier, {
    setLoading: false,
    onPending: (state, action) => { state.importing[action.meta.arg.id] = true; state.error = null; },
    onFulfilled: (state, action) => { state.importing[action.meta.arg.id] = false; },
    onRejected: (state, action) => { state.importing[action.meta.arg.id] = false; state.error = action.payload; },
  }],
]);

const syncSlice = createAsyncSlice({
  name: 'sync',
  initialState,
  thunks: [
    syncStock,
    syncOrders,
    fetchSyncLogs,
    fetchSyncStatus,
    fetchMarketplaces,
    fetchSuppliers,
    testMarketplaceConnection,
    testSupplierConnection,
    importFromSupplier,
  ],
  options: {
    onFulfilled: (state, action) => {
      switch (action.type) {
        case fetchSyncLogs.fulfilled.type: {
          state.logs = action.payload.logs || action.payload.data || [];
          state.loading = false;
          break;
        }
        case fetchSyncStatus.fulfilled.type: {
          state.status = action.payload.status || action.payload;
          break;
        }
        case fetchMarketplaces.fulfilled.type: {
          state.marketplaces = action.payload.marketplaces || action.payload.data || [];
          break;
        }
        case fetchSuppliers.fulfilled.type: {
          state.suppliers = action.payload.suppliers || action.payload.data || [];
          break;
        }
        default:
          break;
      }
    },
    onRejected: (state, action) => {
      switch (action.type) {
        case fetchSyncLogs.rejected.type:
          state.loading = false;
          state.error = action.payload;
          break;
        case fetchSyncStatus.rejected.type:
        case fetchMarketplaces.rejected.type:
        case fetchSuppliers.rejected.type:
          state.error = action.payload;
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