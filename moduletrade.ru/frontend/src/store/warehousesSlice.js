// ===================================================
// ФАЙЛ: frontend/src/store/warehousesSlice.js
// ✅ ИСПРАВЛЕНО: Правильные импорты из новой API архитектуры
// ===================================================
import { createAsyncThunk } from '@reduxjs/toolkit';
import { createAsyncSlice } from './helpers/asyncHelpers';
import { api } from 'services'; // Импорт из правильного места

// =====================================
// ASYNC THUNKS
// =====================================

export const fetchWarehouses = createAsyncThunk(
  'warehouses/fetchWarehouses',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await api.warehouses.getWarehouses(params);
      return response;
    } catch (error) {
      return rejectWithValue({
        message: error.message || 'Ошибка загрузки складов',
        status: error.status
      });
    }
  }
);

export const fetchWarehouse = createAsyncThunk(
  'warehouses/fetchWarehouse',
  async (id, { rejectWithValue }) => {
    try {
      const response = await api.warehouses.getWarehouse(id);
      return response;
    } catch (error) {
      return rejectWithValue({
        message: error.message || 'Ошибка загрузки склада',
        status: error.status
      });
    }
  }
);

export const createWarehouse = createAsyncThunk(
  'warehouses/createWarehouse',
  async (warehouseData, { rejectWithValue }) => {
    try {
      const response = await api.warehouses.createWarehouse(warehouseData);
      return response;
    } catch (error) {
      return rejectWithValue({
        message: error.message || 'Ошибка создания склада',
        status: error.status
      });
    }
  }
);

export const updateWarehouse = createAsyncThunk(
  'warehouses/updateWarehouse',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await api.warehouses.updateWarehouse(id, data);
      return response;
    } catch (error) {
      return rejectWithValue({
        message: error.message || 'Ошибка обновления склада',
        status: error.status
      });
    }
  }
);

export const deleteWarehouse = createAsyncThunk(
  'warehouses/deleteWarehouse',
  async (id, { rejectWithValue }) => {
    try {
      await api.warehouses.deleteWarehouse(id);
      return id;
    } catch (error) {
      return rejectWithValue({
        message: error.message || 'Ошибка удаления склада',
        status: error.status
      });
    }
  }
);

export const fetchWarehouseStock = createAsyncThunk(
  'warehouses/fetchWarehouseStock',
  async ({ id, params = {} }, { rejectWithValue }) => {
    try {
      const response = await api.warehouses.getWarehouseStock(id, params);
      return { warehouseId: id, stock: response };
    } catch (error) {
      return rejectWithValue({
        message: error.message || 'Ошибка загрузки остатков склада',
        status: error.status
      });
    }
  }
);

export const fetchWarehouseMovements = createAsyncThunk(
  'warehouses/fetchWarehouseMovements',
  async ({ id, params = {} }, { rejectWithValue }) => {
    try {
      const response = await api.warehouses.getWarehouseMovements(id, params);
      return { warehouseId: id, movements: response };
    } catch (error) {
      return rejectWithValue({
        message: error.message || 'Ошибка загрузки движений склада',
        status: error.status
      });
    }
  }
);

export const transferStock = createAsyncThunk(
  'warehouses/transferStock',
  async (transferData, { rejectWithValue }) => {
    try {
      const response = await api.warehouses.transferStock(transferData);
      return response;
    } catch (error) {
      return rejectWithValue({
        message: error.message || 'Ошибка перемещения товара',
        status: error.status
      });
    }
  }
);

export const updateStock = createAsyncThunk(
  'warehouses/updateStock',
  async ({ warehouseId, productId, quantity, operation = 'set' }, { rejectWithValue }) => {
    try {
      const response = await api.warehouses.updateStock({
        warehouse_id: warehouseId,
        product_id: productId,
        quantity,
        operation
      });
      return response;
    } catch (error) {
      return rejectWithValue({
        message: error.message || 'Ошибка обновления остатков',
        status: error.status
      });
    }
  }
);

// =====================================
// INITIAL STATE
// =====================================

const initialState = {
  warehouses: [],
  currentWarehouse: null,
  warehouseStock: {},
  warehouseMovements: {},

  // Состояния загрузки
  loading: false,
  warehouseLoading: false,
  stockLoading: false,
  movementsLoading: false,
  transferring: false,

  // Ошибки
  error: null,
  stockError: null,
  movementsError: null,

  // Пагинация и фильтры
  pagination: {
    current: 1,
    pageSize: 20,
    total: 0,
  },

  filters: {
    search: '',
    type: 'all', // physical, virtual, multi
    status: 'all', // active, inactive
    region: '',
  },

  // Статистика
  stats: {
    total: 0,
    active: 0,
    totalProducts: 0,
    totalValue: 0,
  },

  // Конфигурация склада
  stockFilters: {
    search: '',
    category: '',
    lowStock: false,
    outOfStock: false,
  },

  movementsFilters: {
    dateFrom: null,
    dateTo: null,
    type: 'all', // in, out, transfer, adjustment
    productId: null,
  },
};

// =====================================
// SLICE
// =====================================

// Перенос обработки в helper с per-thunk конфигами
const thunkConfigs = new Map([
  [fetchWarehouses, {
    onPending: (state) => { state.loading = true; state.error = null; },
    onFulfilled: (state, action) => {
      state.loading = false;
      state.warehouses = action.payload.warehouses || [];
      state.pagination.total = action.payload.total || 0;
      state.stats = action.payload.stats || state.stats;
    },
    onRejected: (state, action) => { state.loading = false; state.error = action.payload.message; },
  }],
  [fetchWarehouse, {
    onPending: (state) => { state.warehouseLoading = true; state.error = null; },
    onFulfilled: (state, action) => { state.warehouseLoading = false; state.currentWarehouse = action.payload; },
    onRejected: (state, action) => { state.warehouseLoading = false; state.error = action.payload.message; },
  }],
  [createWarehouse, {
    onPending: (state) => { state.loading = true; state.error = null; },
    onFulfilled: (state, action) => {
      state.loading = false;
      state.warehouses.unshift(action.payload);
      state.pagination.total += 1;
      state.stats.total += 1;
      if (action.payload.is_active) state.stats.active += 1;
    },
    onRejected: (state, action) => { state.loading = false; state.error = action.payload.message; },
  }],
  [updateWarehouse, {
    onPending: (state) => { state.loading = true; state.error = null; },
    onFulfilled: (state, action) => {
      state.loading = false;
      const updated = action.payload;
      const index = state.warehouses.findIndex((w) => w.id === updated.id);
      if (index !== -1) state.warehouses[index] = updated;
      if (state.currentWarehouse?.id === updated.id) state.currentWarehouse = updated;
    },
    onRejected: (state, action) => { state.loading = false; state.error = action.payload.message; },
  }],
  [deleteWarehouse, {
    onPending: (state) => { state.loading = true; state.error = null; },
    onFulfilled: (state, action) => {
      state.loading = false;
      const deletedId = action.payload;
      const deletedWarehouse = state.warehouses.find((w) => w.id === deletedId);
      state.warehouses = state.warehouses.filter((w) => w.id !== deletedId);
      state.pagination.total = Math.max(0, state.pagination.total - 1);
      state.stats.total = Math.max(0, state.stats.total - 1);
      if (deletedWarehouse?.is_active) state.stats.active = Math.max(0, state.stats.active - 1);
      if (state.currentWarehouse?.id === deletedId) state.currentWarehouse = null;
      delete state.warehouseStock[deletedId];
      delete state.warehouseMovements[deletedId];
    },
    onRejected: (state, action) => { state.loading = false; state.error = action.payload.message; },
  }],
  [fetchWarehouseStock, {
    setLoading: false,
    onPending: (state) => { state.stockLoading = true; state.stockError = null; },
    onFulfilled: (state, action) => {
      state.stockLoading = false;
      const { warehouseId, stock } = action.payload;
      // нормализуем: ожидаем структуру { stock: [], pagination }
      state.warehouseStock[warehouseId] = stock;
    },
    onRejected: (state, action) => { state.stockLoading = false; state.stockError = action.payload.message; },
  }],
  [fetchWarehouseMovements, {
    setLoading: false,
    onPending: (state) => { state.movementsLoading = true; state.movementsError = null; },
    onFulfilled: (state, action) => {
      state.movementsLoading = false;
      const { warehouseId, movements } = action.payload;
      state.warehouseMovements[warehouseId] = movements;
    },
    onRejected: (state, action) => { state.movementsLoading = false; state.movementsError = action.payload.message; },
  }],
  [transferStock, {
    setLoading: false,
    onPending: (state) => { state.transferring = true; state.error = null; },
    onFulfilled: (state, action) => {
      state.transferring = false;
      const transfer = action.payload;
      if (transfer.from_warehouse_id && state.warehouseStock[transfer.from_warehouse_id]) {
        // при необходимости обновить остатки источника
      }
      if (transfer.to_warehouse_id && state.warehouseStock[transfer.to_warehouse_id]) {
        // при необходимости обновить остатки назначения
      }
    },
    onRejected: (state, action) => { state.transferring = false; state.error = action.payload.message; },
  }],
  [updateStock, {
    onPending: (state) => { state.loading = true; state.error = null; },
    onFulfilled: (state, action) => {
      state.loading = false;
      const stockUpdate = action.payload;
      const wid = stockUpdate.warehouse_id;
      if (wid && state.warehouseStock[wid] && Array.isArray(state.warehouseStock[wid].stock)) {
        const stockItems = state.warehouseStock[wid].stock;
        const itemIndex = stockItems.findIndex((item) => item.product_id === stockUpdate.product_id);
        if (itemIndex !== -1) stockItems[itemIndex].quantity = stockUpdate.new_quantity;
      }
    },
    onRejected: (state, action) => { state.loading = false; state.error = action.payload.message; },
  }],
]);

const warehousesSlice = createAsyncSlice({
  name: 'warehouses',
  initialState,
  thunks: [
    fetchWarehouses,
    fetchWarehouse,
    createWarehouse,
    updateWarehouse,
    deleteWarehouse,
    fetchWarehouseStock,
    fetchWarehouseMovements,
    transferStock,
    updateStock,
  ],
  thunkConfigs,
  reducers: {
    clearWarehouses: (state) => {
      state.warehouses = [];
      state.pagination.total = 0;
    },

    clearCurrentWarehouse: (state) => {
      state.currentWarehouse = null;
    },

    clearWarehouseStock: (state, action) => {
      const warehouseId = action.payload;
      if (warehouseId) {
        delete state.warehouseStock[warehouseId];
      } else {
        state.warehouseStock = {};
      }
    },

    clearWarehouseMovements: (state, action) => {
      const warehouseId = action.payload;
      if (warehouseId) {
        delete state.warehouseMovements[warehouseId];
      } else {
        state.warehouseMovements = {};
      }
    },

    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },

    setStockFilters: (state, action) => {
      state.stockFilters = { ...state.stockFilters, ...action.payload };
    },

    setMovementsFilters: (state, action) => {
      state.movementsFilters = { ...state.movementsFilters, ...action.payload };
    },

    setPagination: (state, action) => {
      state.pagination = { ...state.pagination, ...action.payload };
    },

    clearError: (state) => {
      state.error = null;
      state.stockError = null;
      state.movementsError = null;
    },

    updateWarehouseInList: (state, action) => {
      const { id, data } = action.payload;
      const index = state.warehouses.findIndex(warehouse => warehouse.id === id);
      if (index !== -1) {
        state.warehouses[index] = { ...state.warehouses[index], ...data };
      }
    },

    removeWarehouseFromList: (state, action) => {
      const id = action.payload;
      state.warehouses = state.warehouses.filter(warehouse => warehouse.id !== id);
      state.pagination.total = Math.max(0, state.pagination.total - 1);
    },
  },
});

// =====================================
// EXPORTS
// =====================================

export const {
  clearWarehouses,
  clearCurrentWarehouse,
  clearWarehouseStock,
  clearWarehouseMovements,
  setFilters,
  setStockFilters,
  setMovementsFilters,
  setPagination,
  clearError,
  updateWarehouseInList,
  removeWarehouseFromList,
} = warehousesSlice.actions;

export default warehousesSlice.reducer;

// =====================================
// SELECTORS
// =====================================

export const selectWarehouses = (state) => state.warehouses.warehouses;
export const selectCurrentWarehouse = (state) => state.warehouses.currentWarehouse;
export const selectWarehouseStock = (state) => state.warehouses.warehouseStock;
export const selectWarehouseMovements = (state) => state.warehouses.warehouseMovements;
export const selectWarehousesLoading = (state) => state.warehouses.loading;
export const selectWarehouseLoading = (state) => state.warehouses.warehouseLoading;
export const selectStockLoading = (state) => state.warehouses.stockLoading;
export const selectMovementsLoading = (state) => state.warehouses.movementsLoading;
export const selectTransferring = (state) => state.warehouses.transferring;
export const selectWarehousesError = (state) => state.warehouses.error;
export const selectStockError = (state) => state.warehouses.stockError;
export const selectMovementsError = (state) => state.warehouses.movementsError;
export const selectWarehousesPagination = (state) => state.warehouses.pagination;
export const selectWarehousesFilters = (state) => state.warehouses.filters;
export const selectStockFilters = (state) => state.warehouses.stockFilters;
export const selectMovementsFilters = (state) => state.warehouses.movementsFilters;
export const selectWarehousesStats = (state) => state.warehouses.stats;