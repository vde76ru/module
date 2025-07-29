// frontend/src/store/warehousesSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { warehousesAPI } from '../services/api';

// Асинхронные действия
export const fetchWarehouses = createAsyncThunk(
  'warehouses/fetchWarehouses',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await warehousesAPI.getWarehouses(params);
      return response.data;
    } catch (error) {
      return rejectWithValue({
        message: error.response?.data?.message || error.message,
        status: error.response?.status
      });
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
      return rejectWithValue({
        message: error.response?.data?.message || error.message,
        status: error.response?.status
      });
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
      return rejectWithValue({
        message: error.response?.data?.message || error.message,
        status: error.response?.status
      });
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
      return rejectWithValue({
        message: error.response?.data?.message || error.message,
        status: error.response?.status
      });
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
      return rejectWithValue({
        message: error.response?.data?.message || error.message,
        status: error.response?.status
      });
    }
  }
);

export const fetchWarehouseStock = createAsyncThunk(
  'warehouses/fetchWarehouseStock',
  async ({ id, params = {} }, { rejectWithValue }) => {
    try {
      const response = await warehousesAPI.getWarehouseStock(id, params);
      return { warehouseId: id, stock: response.data };
    } catch (error) {
      return rejectWithValue({
        message: error.response?.data?.message || error.message,
        status: error.response?.status
      });
    }
  }
);

export const updateStock = createAsyncThunk(
  'warehouses/updateStock',
  async ({ warehouseId, productId, quantity, reason }, { rejectWithValue }) => {
    try {
      const response = await warehousesAPI.updateStock(warehouseId, productId, quantity, reason);
      return response.data;
    } catch (error) {
      return rejectWithValue({
        message: error.response?.data?.message || error.message,
        status: error.response?.status
      });
    }
  }
);

export const transferProduct = createAsyncThunk(
  'warehouses/transferProduct',
  async ({ fromWarehouseId, toWarehouseId, items }, { rejectWithValue }) => {
    try {
      const response = await warehousesAPI.transferStock(fromWarehouseId, toWarehouseId, items);
      return response.data;
    } catch (error) {
      return rejectWithValue({
        message: error.response?.data?.message || error.message,
        status: error.response?.status
      });
    }
  }
);

export const fetchWarehouseMovements = createAsyncThunk(
  'warehouses/fetchWarehouseMovements',
  async ({ warehouseId, params = {} }, { rejectWithValue }) => {
    try {
      const response = await warehousesAPI.getMovements(warehouseId, params);
      return { warehouseId, movements: response.data };
    } catch (error) {
      return rejectWithValue({
        message: error.response?.data?.message || error.message,
        status: error.response?.status
      });
    }
  }
);

// Начальное состояние
const initialState = {
  items: [], // ✅ ВАЖНО: Всегда инициализируем как массив
  currentWarehouse: null,
  stock: {},
  movements: {},
  loading: false,
  error: null,
  stockLoading: false,
  stockError: null,
  movementsLoading: false,
  movementsError: null,
  pagination: {
    total: 0,
    page: 1,
    limit: 20,
    pages: 1
  }
};

// Slice
const warehousesSlice = createSlice({
  name: 'warehouses',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
      state.stockError = null;
      state.movementsError = null;
    },
    clearCurrentWarehouse: (state) => {
      state.currentWarehouse = null;
    },
    setWarehouseFilter: (state, action) => {
      state.filters = action.payload;
    },
    resetWarehousesState: (state) => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    // Получение списка складов
    builder
      .addCase(fetchWarehouses.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchWarehouses.fulfilled, (state, action) => {
        state.loading = false;
        // ✅ БЕЗОПАСНОЕ ПРИСВОЕНИЕ: Убеждаемся что это массив
        state.items = Array.isArray(action.payload.data)
          ? action.payload.data
          : Array.isArray(action.payload)
            ? action.payload
            : [];

        if (action.payload.pagination) {
          state.pagination = action.payload.pagination;
        }
      })
      .addCase(fetchWarehouses.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Ошибка загрузки складов';
        // ✅ Сохраняем пустой массив при ошибке
        state.items = [];
      });

    // Получение одного склада
    builder
      .addCase(fetchWarehouse.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchWarehouse.fulfilled, (state, action) => {
        state.loading = false;
        state.currentWarehouse = action.payload.data || action.payload;
      })
      .addCase(fetchWarehouse.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Ошибка загрузки склада';
      });

    // Создание склада
    builder
      .addCase(createWarehouse.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createWarehouse.fulfilled, (state, action) => {
        state.loading = false;
        const newWarehouse = action.payload.data || action.payload;
        // ✅ БЕЗОПАСНОЕ ДОБАВЛЕНИЕ В МАССИВ
        if (Array.isArray(state.items)) {
          state.items.unshift(newWarehouse);
        } else {
          state.items = [newWarehouse];
        }
      })
      .addCase(createWarehouse.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Ошибка создания склада';
      });

    // Обновление склада
    builder
      .addCase(updateWarehouse.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateWarehouse.fulfilled, (state, action) => {
        state.loading = false;
        const updatedWarehouse = action.payload.data || action.payload;

        // ✅ БЕЗОПАСНОЕ ОБНОВЛЕНИЕ В МАССИВЕ
        if (Array.isArray(state.items)) {
          const index = state.items.findIndex(item => item.id === updatedWarehouse.id);
          if (index !== -1) {
            state.items[index] = updatedWarehouse;
          }
        }

        if (state.currentWarehouse?.id === updatedWarehouse.id) {
          state.currentWarehouse = updatedWarehouse;
        }
      })
      .addCase(updateWarehouse.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Ошибка обновления склада';
      });

    // Удаление склада
    builder
      .addCase(deleteWarehouse.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteWarehouse.fulfilled, (state, action) => {
        state.loading = false;
        const deletedId = action.payload;

        // ✅ БЕЗОПАСНОЕ УДАЛЕНИЕ ИЗ МАССИВА
        if (Array.isArray(state.items)) {
          state.items = state.items.filter(item => item.id !== deletedId);
        }

        if (state.currentWarehouse?.id === deletedId) {
          state.currentWarehouse = null;
        }
      })
      .addCase(deleteWarehouse.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Ошибка удаления склада';
      });

    // Получение остатков склада
    builder
      .addCase(fetchWarehouseStock.pending, (state) => {
        state.stockLoading = true;
        state.stockError = null;
      })
      .addCase(fetchWarehouseStock.fulfilled, (state, action) => {
        state.stockLoading = false;
        const { warehouseId, stock } = action.payload;
        state.stock[warehouseId] = Array.isArray(stock.data) ? stock.data :
                                  Array.isArray(stock) ? stock : [];
      })
      .addCase(fetchWarehouseStock.rejected, (state, action) => {
        state.stockLoading = false;
        state.stockError = action.payload?.message || 'Ошибка загрузки остатков';
      });

    // Обновление остатков
    builder
      .addCase(updateStock.pending, (state) => {
        state.stockLoading = true;
        state.stockError = null;
      })
      .addCase(updateStock.fulfilled, (state, action) => {
        state.stockLoading = false;
        // Обновляем остатки в state.stock при необходимости
      })
      .addCase(updateStock.rejected, (state, action) => {
        state.stockLoading = false;
        state.stockError = action.payload?.message || 'Ошибка обновления остатков';
      });

    // Перемещение товаров
    builder
      .addCase(transferProduct.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(transferProduct.fulfilled, (state, action) => {
        state.loading = false;
        // Можно обновить остатки или уведомить об успешном перемещении
      })
      .addCase(transferProduct.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Ошибка перемещения товара';
      });

    // Получение движений по складу
    builder
      .addCase(fetchWarehouseMovements.pending, (state) => {
        state.movementsLoading = true;
        state.movementsError = null;
      })
      .addCase(fetchWarehouseMovements.fulfilled, (state, action) => {
        state.movementsLoading = false;
        const { warehouseId, movements } = action.payload;
        state.movements[warehouseId] = Array.isArray(movements.data) ? movements.data :
                                      Array.isArray(movements) ? movements : [];
      })
      .addCase(fetchWarehouseMovements.rejected, (state, action) => {
        state.movementsLoading = false;
        state.movementsError = action.payload?.message || 'Ошибка загрузки движений';
      });
  }
});

// Экспорт действий
export const {
  clearError,
  clearCurrentWarehouse,
  setWarehouseFilter,
  resetWarehousesState
} = warehousesSlice.actions;

// Селекторы
export const selectWarehouses = (state) => state.warehouses?.items || [];
export const selectWarehousesLoading = (state) => state.warehouses?.loading || false;
export const selectWarehousesError = (state) => state.warehouses?.error;
export const selectCurrentWarehouse = (state) => state.warehouses?.currentWarehouse;
export const selectWarehouseStock = (warehouseId) => (state) =>
  state.warehouses?.stock?.[warehouseId] || [];
export const selectWarehouseMovements = (warehouseId) => (state) =>
  state.warehouses?.movements?.[warehouseId] || [];

// Экспорт редьюсера
export default warehousesSlice.reducer;