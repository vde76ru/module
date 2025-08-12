const ETMAdapter = require('./ETMAdapter');
const RS24Adapter = require('./RS24Adapter');
const RestSupplierAdapter = require('./RestSupplierAdapter');
const logger = require('../utils/logger');

/**
 * Фабрика для создания адаптеров поставщиков
 */
class SupplierFactory {
  constructor() {
    this.adapters = {
      etm: ETMAdapter,
      rs24: RS24Adapter,
      rest: RestSupplierAdapter
      // Дополнительные адаптеры (soap/xml/file) могут быть добавлены позднее
    };
  }

  /**
   * Создание адаптера по типу
   */
  createAdapter(type, config) {
    if (!type) {
      throw new Error('Supplier type is required');
    }

    const normalizedType = String(type).toLowerCase();
    logger.info(`Creating supplier adapter of type: ${normalizedType}`);

    const AdapterClass = this.adapters[normalizedType];
    if (!AdapterClass) {
      throw new Error(`Unknown supplier type: ${type}`);
    }

    return new AdapterClass(config || {});
  }

  /**
   * Регистрация нового адаптера
   */
  registerAdapter(name, AdapterClass) {
    if (!name || typeof AdapterClass !== 'function') {
      throw new Error('Invalid adapter registration');
    }
    this.adapters[String(name).toLowerCase()] = AdapterClass;
    logger.info(`Registered supplier adapter: ${name}`);
  }

  /**
   * Доступные адаптеры
   */
  getAvailableAdapters() {
    return Object.keys(this.adapters);
  }
}

// Экспортируем синглтон
module.exports = new SupplierFactory();
