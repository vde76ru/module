const OzonAdapter = require('./OzonAdapter');
const YandexAdapter = require('./YandexAdapter');
const WildberriesAdapter = require('./WildberriesAdapter');

class MarketplaceFactory {
  createAdapter(type, config) {
    switch (type) {
      case 'ozon':
        return new OzonAdapter(config);
      case 'yandex':
        return new YandexAdapter(config);
      case 'wildberries':
        return new WildberriesAdapter(config);
      default:
        throw new Error(`Unknown marketplace type: ${type}`);
    }
  }
}
module.exports = MarketplaceFactory;