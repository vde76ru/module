// backend/src/services/NormalizationService.js
const logger = require('../utils/logger');

class NormalizationService {
  /**
   * Нормализация данных товара от поставщика
   */
  normalizeProduct(rawProduct) {
    try {
      return {
        sku: this.normalizeSku(rawProduct.sku || rawProduct.article || rawProduct.id),
        name: this.normalizeProductName(rawProduct.name || rawProduct.title),
        description: this.normalizeDescription(rawProduct.description),
        brand: this.normalizeBrandName(rawProduct.brand || rawProduct.manufacturer),
        category: this.normalizeCategoryPath(rawProduct.category || rawProduct.categoryPath),
        barcode: this.normalizeBarcode(rawProduct.barcode || rawProduct.ean || rawProduct.gtin),
        price: this.normalizePrice(rawProduct.price),
        currency: rawProduct.currency || 'RUB',
        mrcPrice: this.normalizePrice(rawProduct.mrcPrice || rawProduct.minPrice),
        enforceMrc: Boolean(rawProduct.enforceMrc || rawProduct.enforceMinPrice),
        quantity: this.normalizeQuantity(rawProduct.quantity || rawProduct.stock || 0),
        isAvailable: this.normalizeAvailability(rawProduct),
        images: this.normalizeImages(rawProduct.images || rawProduct.photos || []),
        attributes: this.normalizeAttributes(rawProduct.attributes || rawProduct.properties || {}),
        weight: this.normalizeWeight(rawProduct.weight),
        volume: this.normalizeVolume(rawProduct.volume),
        dimensions: this.normalizeDimensions(rawProduct.dimensions || rawProduct.size),
        is_divisible: this.normalizeDivisibility(rawProduct),
        supplierSku: rawProduct.supplierSku || rawProduct.vendorCode
      };
    } catch (error) {
      logger.error('Error normalizing product:', error);
      throw new Error(`Failed to normalize product: ${error.message}`);
    }
  }

  /**
   * Нормализация SKU
   */
  normalizeSku(sku) {
    if (!sku) {
      throw new Error('SKU is required');
    }
    
    // Удаляем пробелы, приводим к верхнему регистру
    return String(sku)
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]/g, '');
  }

  /**
   * Нормализация названия товара
   */
  normalizeProductName(name) {
    if (!name) return null;
    
    return String(name)
      .trim()
      .replace(/\s+/g, ' ')
      .substring(0, 500); // Ограничиваем длину
  }

  /**
   * Нормализация описания
   */
  normalizeDescription(description) {
    if (!description) return null;
    
    // Удаляем HTML теги, если есть
    const withoutHtml = String(description)
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&[a-z]+;/gi, '');
    
    // Нормализуем пробелы
    return withoutHtml
      .trim()
      .replace(/\s+/g, ' ')
      .substring(0, 5000); // Ограничиваем длину
  }

  /**
   * Нормализация названия бренда
   */
  normalizeBrandName(brand) {
    if (!brand) return null;
    
    // Словарь для унификации известных брендов
    const brandAliases = {
      'SAMSUNG': ['Samsung', 'САМСУНГ', 'самсунг'],
      'APPLE': ['Apple', 'ЭППЛ', 'эппл', 'Эпл'],
      'XIAOMI': ['Xiaomi', 'СЯОМИ', 'сяоми', 'Mi'],
      'LG': ['Lg', 'ЛДжи', 'лджи'],
      // Добавьте другие бренды по необходимости
    };
    
    const normalizedBrand = String(brand).trim();
    
    // Проверяем алиасы
    for (const [canonical, aliases] of Object.entries(brandAliases)) {
      if (aliases.some(alias => 
        normalizedBrand.toLowerCase() === alias.toLowerCase()
      )) {
        return canonical;
      }
    }
    
    // Если не нашли в алиасах, просто нормализуем регистр
    return normalizedBrand
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Нормализация пути категории
   */
  normalizeCategoryPath(category) {
    if (!category) return null;
    
    if (Array.isArray(category)) {
      return category.map(c => String(c).trim()).join('/');
    }
    
    return String(category)
      .trim()
      .replace(/\s*[>\/]\s*/g, '/'); // Поддержка разных разделителей
  }

  /**
   * Нормализация штрихкода
   */
  normalizeBarcode(barcode) {
    if (!barcode) return null;
    
    const cleaned = String(barcode).replace(/\D/g, '');
    
    // Проверяем валидность штрихкода (8, 12, 13 или 14 цифр)
    if ([8, 12, 13, 14].includes(cleaned.length)) {
      return cleaned;
    }
    
    return null;
  }

  /**
   * Нормализация цены
   */
  normalizePrice(price) {
    if (price === null || price === undefined) return null;
    
    // Обрабатываем строки с ценой
    if (typeof price === 'string') {
      // Удаляем все символы кроме цифр, точки и запятой
      const cleaned = price.replace(/[^\d.,]/g, '');
      // Заменяем запятую на точку
      const normalized = cleaned.replace(',', '.');
      return parseFloat(normalized) || null;
    }
    
    const numPrice = Number(price);
    return isNaN(numPrice) || numPrice < 0 ? null : numPrice;
  }

  /**
   * Нормализация количества с учетом делимости товара
   */
  normalizeQuantity(quantity, product = null) {
    if (quantity === null || quantity === undefined) return 0;
    
    const numQuantity = Number(quantity);
    if (isNaN(numQuantity) || numQuantity < 0) return 0;
    
    // Если у нас есть информация о товаре и он неделимый, округляем вниз
    if (product && product.is_divisible === false) {
      return Math.floor(numQuantity);
    }
    
    return numQuantity;
  }

  /**
   * Нормализация доступности
   */
  normalizeAvailability(rawProduct) {
    // Различные способы определения доступности
    if (rawProduct.isAvailable !== undefined) {
      return Boolean(rawProduct.isAvailable);
    }
    
    if (rawProduct.available !== undefined) {
      return Boolean(rawProduct.available);
    }
    
    if (rawProduct.inStock !== undefined) {
      return Boolean(rawProduct.inStock);
    }
    
    // Если есть количество больше 0, считаем доступным
    const quantity = this.normalizeQuantity(rawProduct.quantity || rawProduct.stock);
    return quantity > 0;
  }

  /**
   * Нормализация изображений
   */
  normalizeImages(images) {
    if (!images) return [];
    
    const imageArray = Array.isArray(images) ? images : [images];
    
    return imageArray
      .filter(img => img && (typeof img === 'string' || img.url))
      .map(img => {
        if (typeof img === 'string') {
          return this.normalizeImageUrl(img);
        }
        return this.normalizeImageUrl(img.url || img.src);
      })
      .filter(url => url !== null)
      .slice(0, 10); // Ограничиваем количество изображений
  }

  /**
   * Нормализация URL изображения
   */
  normalizeImageUrl(url) {
    if (!url) return null;
    
    const urlString = String(url).trim();
    
    // Проверяем, что это валидный URL
    try {
      const urlObj = new URL(urlString.startsWith('//') ? `https:${urlString}` : urlString);
      return urlObj.href;
    } catch (e) {
      // Если не полный URL, пробуем добавить протокол
      if (urlString.startsWith('/')) {
        return null; // Относительные пути не поддерживаем
      }
      return null;
    }
  }

  /**
   * Нормализация атрибутов
   */
  normalizeAttributes(attributes) {
    if (!attributes || typeof attributes !== 'object') return {};
    
    const normalized = {};
    
    for (const [key, value] of Object.entries(attributes)) {
      // Нормализуем ключ: убираем спецсимволы, приводим к camelCase
      const normalizedKey = this.normalizeAttributeKey(key);
      
      if (normalizedKey && value !== null && value !== undefined) {
        normalized[normalizedKey] = this.normalizeAttributeValue(value);
      }
    }
    
    return normalized;
  }

  /**
   * Нормализация ключа атрибута
   */
  normalizeAttributeKey(key) {
    if (!key) return null;
    
    return String(key)
      .trim()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+(.)/g, (match, chr) => chr.toUpperCase())
      .replace(/^\w/, chr => chr.toLowerCase());
  }

  /**
   * Нормализация значения атрибута
   */
  normalizeAttributeValue(value) {
    if (Array.isArray(value)) {
      return value.map(v => String(v).trim()).filter(v => v);
    }
    
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    
    return String(value).trim();
  }

  /**
   * Нормализация веса (в килограммах)
   */
  normalizeWeight(weight) {
    if (!weight) return null;
    
    // Обрабатываем объект с весом и единицей измерения
    if (typeof weight === 'object' && weight.value) {
      const value = parseFloat(weight.value);
      const unit = (weight.unit || 'kg').toLowerCase();
      
      // Конвертируем в килограммы
      switch (unit) {
        case 'g':
        case 'gram':
        case 'grams':
          return value / 1000;
        case 'mg':
          return value / 1000000;
        case 'lb':
        case 'pound':
        case 'pounds':
          return value * 0.453592;
        default:
          return value;
      }
    }
    
    const numWeight = parseFloat(weight);
    return isNaN(numWeight) || numWeight <= 0 ? null : numWeight;
  }

  /**
   * Нормализация объема (в кубических метрах)
   */
  normalizeVolume(volume) {
    if (!volume) return null;
    
    // Обрабатываем объект с объемом и единицей измерения
    if (typeof volume === 'object' && volume.value) {
      const value = parseFloat(volume.value);
      const unit = (volume.unit || 'm3').toLowerCase();
      
      // Конвертируем в кубические метры
      switch (unit) {
        case 'cm3':
        case 'cc':
          return value / 1000000;
        case 'l':
        case 'liter':
        case 'liters':
          return value / 1000;
        case 'ml':
          return value / 1000000;
        default:
          return value;
      }
    }
    
    const numVolume = parseFloat(volume);
    return isNaN(numVolume) || numVolume <= 0 ? null : numVolume;
  }

  /**
   * Нормализация габаритов
   */
  normalizeDimensions(dimensions) {
    if (!dimensions) return null;
    
    // Обрабатываем строку вида "10x20x30"
    if (typeof dimensions === 'string') {
      const parts = dimensions.split(/[xх×*]/i).map(p => parseFloat(p.trim()));
      if (parts.length === 3 && parts.every(p => !isNaN(p) && p > 0)) {
        return {
          length: parts[0],
          width: parts[1],
          height: parts[2]
        };
      }
    }
    
    // Обрабатываем объект
    if (typeof dimensions === 'object') {
      const length = parseFloat(dimensions.length || dimensions.l);
      const width = parseFloat(dimensions.width || dimensions.w);
      const height = parseFloat(dimensions.height || dimensions.h);
      
      if (!isNaN(length) && !isNaN(width) && !isNaN(height)) {
        return { length, width, height };
      }
    }
    
    return null;
  }

  /**
   * Определение делимости товара
   */
  normalizeDivisibility(rawProduct) {
    // Явно указанная делимость
    if (rawProduct.is_divisible !== undefined) {
      return Boolean(rawProduct.is_divisible);
    }
    
    if (rawProduct.isDivisible !== undefined) {
      return Boolean(rawProduct.isDivisible);
    }
    
    if (rawProduct.divisible !== undefined) {
      return Boolean(rawProduct.divisible);
    }
    
    // Определяем по единице измерения
    const unit = rawProduct.unit || rawProduct.measureUnit || '';
    const divisibleUnits = ['кг', 'г', 'л', 'мл', 'м', 'см', 'kg', 'g', 'l', 'ml', 'm', 'cm'];
    
    if (divisibleUnits.some(u => unit.toLowerCase().includes(u))) {
      return true;
    }
    
    // По умолчанию считаем товар делимым
    return true;
  }

  /**
   * Нормализация данных заказа от маркетплейса
   */
  normalizeMarketplaceOrder(rawOrder, marketplaceType) {
    try {
      return {
        externalId: rawOrder.id || rawOrder.orderId || rawOrder.number,
        orderNumber: rawOrder.number || rawOrder.orderNumber || rawOrder.id,
        status: this.normalizeOrderStatus(rawOrder.status, marketplaceType),
        createdAt: this.normalizeDate(rawOrder.createdAt || rawOrder.created || rawOrder.date),
        customer: this.normalizeCustomer(rawOrder.customer || rawOrder.buyer),
        deliveryAddress: this.normalizeAddress(rawOrder.deliveryAddress || rawOrder.address),
        items: this.normalizeOrderItems(rawOrder.items || rawOrder.products || []),
        totalAmount: this.normalizePrice(rawOrder.total || rawOrder.totalAmount),
        deliveryPrice: this.normalizePrice(rawOrder.deliveryPrice || rawOrder.shippingCost || 0),
        metadata: rawOrder
      };
    } catch (error) {
      logger.error('Error normalizing marketplace order:', error);
      throw new Error(`Failed to normalize order: ${error.message}`);
    }
  }

  /**
   * Нормализация статуса заказа
   */
  normalizeOrderStatus(status, marketplaceType) {
    const statusMappings = {
      ozon: {
        'awaiting_packaging': 'pending',
        'awaiting_deliver': 'processing',
        'delivering': 'shipped',
        'delivered': 'delivered',
        'cancelled': 'cancelled'
      },
      wildberries: {
        'new': 'pending',
        'confirm': 'processing',
        'complete': 'delivered',
        'cancel': 'cancelled'
      },
      yandex: {
        'PROCESSING': 'pending',
        'DELIVERY': 'shipped',
        'DELIVERED': 'delivered',
        'CANCELLED': 'cancelled'
      }
    };

    const mapping = statusMappings[marketplaceType] || {};
    return mapping[status] || 'pending';
  }

  /**
   * Нормализация даты
   */
  normalizeDate(date) {
    if (!date) return new Date();
    
    const parsed = new Date(date);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  /**
   * Нормализация данных покупателя
   */
  normalizeCustomer(customer) {
    if (!customer) return null;
    
    return {
      name: customer.name || customer.fullName || 'Не указано',
      phone: this.normalizePhone(customer.phone || customer.phoneNumber),
      email: customer.email || null
    };
  }

  /**
   * Нормализация телефона
   */
  normalizePhone(phone) {
    if (!phone) return null;
    
    // Удаляем все кроме цифр
    const digits = String(phone).replace(/\D/g, '');
    
    // Проверяем минимальную длину
    if (digits.length < 10) return null;
    
    // Форматируем для России
    if (digits.startsWith('7') && digits.length === 11) {
      return `+${digits}`;
    }
    
    if (digits.startsWith('8') && digits.length === 11) {
      return `+7${digits.substring(1)}`;
    }
    
    return `+${digits}`;
  }

  /**
   * Нормализация адреса
   */
  normalizeAddress(address) {
    if (!address) return null;
    
    if (typeof address === 'string') {
      return address.trim();
    }
    
    const parts = [
      address.country,
      address.region || address.state,
      address.city,
      address.street,
      address.house || address.building,
      address.apartment || address.flat
    ].filter(part => part);
    
    return parts.join(', ') || null;
  }

  /**
   * Нормализация позиций заказа
   */
  normalizeOrderItems(items) {
    return items.map(item => ({
      sku: this.normalizeSku(item.sku || item.article || item.offerId),
      name: item.name || item.title || 'Товар',
      quantity: this.normalizeQuantity(item.quantity || item.count || 1),
      price: this.normalizePrice(item.price),
      totalPrice: this.normalizePrice(item.totalPrice || item.total || (item.price * item.quantity))
    }));
  }
}

module.exports = NormalizationService;
