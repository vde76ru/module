import { createSlice } from '@reduxjs/toolkit';

// Создает стандартные reducers для async thunk
// perThunkConfigs: Map where key is thunk function, value is config:
// { setLoading?: boolean, dataField?: string, dataProcessor?: fn, onPending?: fn, onFulfilled?: fn, onRejected?: fn }
export const createAsyncReducers = (thunks, options = {}, perThunkConfigs = new Map()) => {
  const reducers = {};

  thunks.forEach((thunk) => {
    const cfg = perThunkConfigs.get(thunk) || {};

    reducers[`${thunk.pending}`] = (state, action) => {
      const isScoped = Boolean(action?.meta?.arg?.__scope);
      const shouldSetLoading = cfg.setLoading !== false;
      if (!isScoped && shouldSetLoading) {
        state.loading = true;
        state.error = null;
      }
      if (options.clearDataOnPending) {
        state[options.dataField || 'data'] = options.defaultData || [];
      }

      if (typeof options.onPending === 'function') {
        options.onPending(state, action, thunk);
      }
      if (typeof cfg.onPending === 'function') {
        cfg.onPending(state, action, thunk);
      }
    };

    reducers[`${thunk.fulfilled}`] = (state, action) => {
      const isScoped = Boolean(action?.meta?.arg?.__scope);
      const shouldSetLoading = cfg.setLoading !== false;
      if (!isScoped && shouldSetLoading) {
        state.loading = false;
        state.error = null;
      }

      const hasPerThunkDataField = typeof cfg.dataField === 'string';
      const shouldSetDataField = hasPerThunkDataField || (Array.isArray(options.dataThunks)
        ? options.dataThunks.includes(thunk)
        : Boolean(options.dataField));

      const targetDataField = hasPerThunkDataField ? cfg.dataField : options.dataField;

      if (shouldSetDataField && targetDataField) {
        const dataProcessor = cfg.dataProcessor || options.dataProcessor;
        if (typeof dataProcessor === 'function') {
          state[targetDataField] = dataProcessor(state, action);
        } else {
          state[targetDataField] = action.payload?.data ?? action.payload;
        }
      }

      if (typeof options.onFulfilled === 'function') {
        options.onFulfilled(state, action, thunk);
      }
      if (typeof cfg.onFulfilled === 'function') {
        cfg.onFulfilled(state, action, thunk);
      }
    };

    reducers[`${thunk.rejected}`] = (state, action) => {
      const isScoped = Boolean(action?.meta?.arg?.__scope);
      const shouldSetLoading = cfg.setLoading !== false;
      if (!isScoped && shouldSetLoading) {
        state.loading = false;
        state.error = action.payload || { message: 'Неизвестная ошибка' };
      }

      if (typeof options.onRejected === 'function') {
        options.onRejected(state, action, thunk);
      }
      if (typeof cfg.onRejected === 'function') {
        cfg.onRejected(state, action, thunk);
      }
    };
  });

  return reducers;
};

// Создает enhanced slice с автоматической обработкой async actions
export const createAsyncSlice = ({ name, initialState, thunks, reducers = {}, options = {}, thunkConfigs = new Map() }) => {
  const asyncReducers = createAsyncReducers(thunks, options, thunkConfigs);

  return createSlice({
    name,
    initialState,
    reducers,
    extraReducers: (builder) => {
      Object.entries(asyncReducers).forEach(([actionType, reducer]) => {
        builder.addCase(actionType, reducer);
      });
    },
  });
};

