const ETMAdapter = require('./ETMAdapter');
const RS24Adapter = require('./RS24Adapter');

class SupplierFactory {
  createAdapter(type, config) {
    switch (type) {
      case 'etm':
        return new ETMAdapter(config);
      case 'rs24':
        return new RS24Adapter(config);
      case 'custom':
        // Для кастомных поставщиков можно реализовать универсальный адаптер
        throw new Error('Custom supplier adapter not implemented');
      default:
        throw new Error(`Unknown supplier type: ${type}`);
    }
  }
}

module.exports = SupplierFactory;
