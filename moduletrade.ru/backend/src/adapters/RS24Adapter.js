// ================================================================
// ФАЙЛ: backend/src/adapters/RS24Adapter.js
// Полный адаптер для работы с API Русский Свет (RS24)
// Реализует все методы согласно документации: cdis.russvet.ru/rs
// ================================================================

const axios = require('axios');
const logger = require('../utils/logger');
const BaseSupplierAdapter = require('./BaseSupplierAdapter');

class RS24Adapter extends BaseSupplierAdapter {
  constructor(config) {
    super(config);

    this.baseURL = config.base_url || 'https://cdis.russvet.ru/rs';
    this.login = config.login || config.username;
    this.password = config.password;

    if (!this.login || !this.password) {
      throw new Error('RS24: login and password are required');
    }

    this.basicToken = Buffer.from(`${this.login}:${this.password}`).toString('base64');

    // Настройки лимитов согласно документации
    this.rateLimits = {
      maxRequestsPerPeriod: 150,
      periodSeconds: 30,
      blockDurationHours: 1
    };

    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: config.timeout || 60000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ModuleTrade/1.0',
        'Authorization': `Basic ${this.basicToken}`
      }
    });

    // Система отслеживания запросов для соблюдения лимитов
    this.requestHistory = [];
    this.lastRequestTime = 0;
    this.isBlocked = false;
    this.blockUntil = null;

    this.setupInterceptors();
  }

  setupInterceptors() {
    // Перед запросом проверяем лимиты
    this.client.interceptors.request.use(async (config) => {
      await this.checkRateLimit();
      return config;
    });

    // Обработка ответов и ошибок
    this.client.interceptors.response.use(
      (response) => {
        this.recordRequest();
        return response;
      },
      (error) => {
        this.recordRequest();
        this.handleApiError(error);
        return Promise.reject(error);
      }
    );
  }

  async checkRateLimit() {
    const now = Date.now();

    // Проверяем блокировку
    if (this.isBlocked && this.blockUntil && now < this.blockUntil) {
      const waitTime = Math.ceil((this.blockUntil - now) / 60000);
      throw new Error(`RS24 API blocked. Wait ${waitTime} minutes.`);
    }

    // Очищаем старые запросы
    const cutoff = now - (this.rateLimits.periodSeconds * 1000);
    this.requestHistory = this.requestHistory.filter(time => time > cutoff);

    // Проверяем лимит
    if (this.requestHistory.length >= this.rateLimits.maxRequestsPerPeriod) {
      const oldestRequest = Math.min(...this.requestHistory);
      const waitTime = Math.ceil((this.rateLimits.periodSeconds * 1000 - (now - oldestRequest)) / 1000);

      logger.warn(`RS24 rate limit reached. Waiting ${waitTime} seconds.`);
      await this.sleep(waitTime * 1000);
    }

    // Минимальная задержка между запросами
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < 200) {
      await this.sleep(200 - timeSinceLastRequest);
    }
  }

  recordRequest() {
    const now = Date.now();
    this.requestHistory.push(now);
    this.lastRequestTime = now;
  }

  handleApiError(error) {
    if (error.response?.status === 403) {
      logger.error('RS24 API access blocked - rate limit exceeded');
      this.isBlocked = true;
      this.blockUntil = Date.now() + (this.rateLimits.blockDurationHours * 60 * 60 * 1000);
      throw new Error('RS24 API access blocked due to rate limit. Try again in 1 hour.');
    }

    if (error.response?.status === 401) {
      throw new Error('RS24 authentication failed. Check login and password.');
    }

    logger.error('RS24 API error:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    });
  }

  // ================================================================
  // ОСНОВНЫЕ МЕТОДЫ API СОГЛАСНО ДОКУМЕНТАЦИИ
  // ================================================================

  /**
   * 2. API Склады - GET /stocks
   */
  async getWarehouses() {
    try {
      const response = await this.client.get('/stocks');
      const stocks = response.data?.Stocks || [];

      return stocks.map(stock => ({
        id: stock.ORGANIZATION_ID,
        code: String(stock.ORGANIZATION_ID),
        name: stock.NAME,
        type: 'supplier_warehouse',
        isActive: true,
        externalData: stock
      }));
    } catch (error) {
      logger.error('RS24 getWarehouses error:', error);
      throw new Error(`Failed to fetch warehouses: ${error.message}`);
    }
  }

  /**
   * 3. API Список позиций - GET /position/{warehouseId}/{category}
   */
  async getProducts(params = {}) {
    try {
      const {
        warehouseId,
        category = 'all', // instock|custom|partnerwhstock|all|custcode
        page = 1,
        rows = 1000,
        brands = [],
        withStocks = false,
        withPrices = false,
        withSpecs = false
      } = params;

      if (!warehouseId) {
        throw new Error('warehouseId is required');
      }

      const requestParams = {
        page: Math.max(1, page),
        rows: Math.min(rows, 1000)
      };

      const response = await this.client.get(`/position/${warehouseId}/${category}`, {
        params: requestParams
      });

      const items = response.data?.items || [];
      const meta = response.data?.meta || {};

      let products = this.transformProducts(items);

      // Фильтруем по брендам если указаны
      if (brands.length > 0) {
        products = products.filter(product =>
          brands.some(brand =>
            product.brand && product.brand.toLowerCase().includes(brand.toLowerCase())
          )
        );
      }

      // Дополнительные данные если запрошены
      if (withStocks || withPrices || withSpecs) {
        products = await this.enrichProductData(products, warehouseId, {
          withStocks,
          withPrices,
          withSpecs
        });
      }

      return {
        products,
        pagination: {
          page: page,
          totalPages: meta.last_page || 1,
          totalItems: meta.rows_count || products.length,
          hasNextPage: page < (meta.last_page || 1)
        }
      };
    } catch (error) {
      logger.error('RS24 getProducts error:', error);
      throw new Error(`Failed to fetch products: ${error.message}`);
    }
  }

  /**
   * 4. API Поиск товара по артикулу - POST /finditem
   */
  async findProductByVendorCode(vendorCode) {
    try {
      const response = await this.client.post('/finditem', {
        vendorCode: vendorCode
      });

      const items = response.data?.items || [];
      return this.transformProducts(items);
    } catch (error) {
      logger.error('RS24 findProductByVendorCode error:', error);
      throw new Error(`Failed to find product: ${error.message}`);
    }
  }

  /**
   * 5.1 Попозиционная выгрузка цен - GET /price/{productCode}
   */
  async getProductPrice(productCode) {
    try {
      const response = await this.client.get(`/price/${productCode}`);
      return this.transformPrice(response.data?.Price);
    } catch (error) {
      logger.error('RS24 getProductPrice error:', error);
      throw new Error(`Failed to get price: ${error.message}`);
    }
  }

  /**
   * 5.2 Массовая выгрузка цен - POST /massprice
   */
  async getProductPrices(productCodes) {
    try {
      const chunks = this.chunkArray(productCodes, 50);
      const allPrices = [];

      for (const chunk of chunks) {
        const response = await this.client.post('/massprice', {
          items: chunk.map(code => parseInt(code, 10) || code)
        });

        if (Array.isArray(response.data)) {
          const prices = response.data.map(item => ({
            productCode: item.RSCode,
            ...this.transformPrice(item.Price)
          }));
          allPrices.push(...prices);
        }

        if (chunks.length > 1) {
          await this.sleep(300);
        }
      }

      return allPrices;
    } catch (error) {
      logger.error('RS24 getProductPrices error:', error);
      throw new Error(`Failed to get prices: ${error.message}`);
    }
  }

  /**
   * 6.1 Попозиционная выгрузка остатков - GET /residue/{warehouseId}/{productCode}
   */
  async getProductStock(warehouseId, productCode) {
    try {
      const response = await this.client.get(`/residue/${warehouseId}/${productCode}`);
      return this.transformStock(response.data);
    } catch (error) {
      logger.error('RS24 getProductStock error:', error);
      throw new Error(`Failed to get stock: ${error.message}`);
    }
  }

  /**
   * 6.2 Массовая выгрузка остатков - GET /residue/all/{warehouseId}
   */
  async getWarehouseStocks(warehouseId, options = {}) {
    try {
      const {
        page = 1,
        rows = 200,
        category = 'all',
        partnerstock = 'Y'
      } = options;

      const maxRows = partnerstock === 'Y' ? 90 : 200;
      const requestParams = {
        page: Math.max(1, page),
        rows: Math.min(rows, maxRows),
        category,
        partnerstock
      };

      const response = await this.client.get(`/residue/all/${warehouseId}`, {
        params: requestParams
      });

      const residues = response.data?.residues || [];
      const stocks = residues.map(residue => this.transformStock(residue));

      const totalPages = parseInt(response.headers['x-pagination-page-count'] || '1');
      const totalCount = parseInt(response.headers['x-pagination-total-count'] || stocks.length);

      return {
        stocks,
        pagination: {
          page,
          totalPages,
          totalItems: totalCount,
          hasNextPage: page < totalPages
        }
      };
    } catch (error) {
      logger.error('RS24 getWarehouseStocks error:', error);
      throw new Error(`Failed to get warehouse stocks: ${error.message}`);
    }
  }

  /**
   * 6.3 Массовая выгрузка остатков производителя - GET /partnerwhstock/all/{warehouseId}
   */
  async getPartnerWarehouseStocks(warehouseId, options = {}) {
    try {
      const {
        page = 1,
        rows = 500,
        availability = 'instock'
      } = options;

      const requestParams = {
        page: Math.max(1, page),
        rows: Math.min(rows, 500),
        availability
      };

      const response = await this.client.get(`/partnerwhstock/all/${warehouseId}`, {
        params: requestParams
      });

      const stocks = (response.data?.partnerWarehouseStock || []).map(stock => ({
        productCode: stock.RSCode,
        partnerQuantity: stock.partnerQuantity,
        partnerUOM: stock.partnerUOM,
        partnerUOMOKEI: stock.partnerUOMOKEI,
        estimatedArrivalDate: stock.estimatedArrivalDate,
        partnerQuantityDate: stock.partnerQuantityDate
      }));

      const meta = response.data?.meta || {};

      return {
        stocks,
        pagination: {
          page,
          totalPages: meta.lastPage || 1,
          totalItems: meta.rowCount || stocks.length,
          hasNextPage: page < (meta.lastPage || 1)
        }
      };
    } catch (error) {
      logger.error('RS24 getPartnerWarehouseStocks error:', error);
      throw new Error(`Failed to get partner warehouse stocks: ${error.message}`);
    }
  }

  /**
   * 7. API Характеристики - GET /specs/{productCode}
   */
  async getProductSpecs(productCode) {
    try {
      const response = await this.client.get(`/specs/${productCode}`);
      return this.transformSpecs(response.data);
    } catch (error) {
      logger.error('RS24 getProductSpecs error:', error);
      throw new Error(`Failed to get product specs: ${error.message}`);
    }
  }

  /**
   * Дополнительно: Документы/сертификаты по товару (из раздела SPECS -> CERTIFICATE)
   * Позволяет получить только документы без остальных данных
   */
  async getDocuments(productCode, options = {}) {
    try {
      logger.info(`Getting documents for product: ${productCode}`);

      // Получаем спецификации товара
      const specs = await this.getProductSpecs(productCode);

      const documents = [];

      // Извлекаем документы из структуры, возвращаемой transformSpecs()
      if (specs && specs.documents) {
        const { certificates = [], catalogs = [], passports = [] } = specs.documents;
        // Сертификаты
        for (const cert of certificates) {
          documents.push({
            id: cert.CERT_NUM ? `cert_${cert.CERT_NUM}` : `cert_${Date.now()}`,
            type: 'certificate',
            name: cert.CERT_NUM ? `Certificate ${cert.CERT_NUM}` : 'Certificate',
            url: cert.URL,
            external_url: cert.URL,
            source: 'rs24',
            metadata: { original_data: cert }
          });
        }
        // Каталоги/брошюры
        for (const cat of catalogs) {
          documents.push({
            id: `catalog_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
            type: 'catalog',
            name: 'Catalog/Brochure',
            url: cat.url || cat.URL,
            external_url: cat.url || cat.URL,
            source: 'rs24',
            metadata: { original_data: cat }
          });
        }
        // Паспорта
        for (const pass of passports) {
          documents.push({
            id: `passport_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
            type: 'passport',
            name: 'Passport',
            url: pass.url || pass.URL,
            external_url: pass.url || pass.URL,
            source: 'rs24',
            metadata: { original_data: pass }
          });
        }
      }

      // Загружаем документы по ссылкам если требуется
      if (options.downloadDocuments && documents.length > 0) {
        for (const doc of documents) {
          if (doc.url && options.downloadDocuments.includes(doc.type)) {
            try {
              const downloadedDoc = await this.downloadDocument(doc.url, doc.type);
              doc.local_url = downloadedDoc.localUrl;
              doc.file_size = downloadedDoc.fileSize;
              doc.mime_type = downloadedDoc.mimeType;
            } catch (downloadError) {
              logger.warn(`Failed to download document ${doc.url}:`, downloadError.message);
              doc.download_error = downloadError.message;
            }
          }
        }
      }

      return {
        success: true,
        product_code: productCode,
        documents: documents,
        total: documents.length
      };

    } catch (error) {
      logger.error(`Error getting documents for ${productCode}:`, error);
      throw new Error(`Failed to get documents: ${error.message}`);
    }
  }

  // ================================================================
  // МЕТОДЫ СИНХРОНИЗАЦИИ И МАССОВЫХ ОПЕРАЦИЙ
  // ================================================================

  /**
   * Синхронизация всех товаров с указанными брендами
   */
  async syncProducts(options = {}) {
    try {
      logger.info('Starting RS24 product sync', options);

      const {
        brands = [],
        categories = [],
        updateExisting = false,
        warehouseIds = [],
        withPrices = true,
        withStocks = true,
        withSpecs = false
      } = options;

      // Получаем склады
      const warehouses = await this.getWarehouses();
      const activeWarehouses = warehouseIds.length > 0
        ? warehouses.filter(w => warehouseIds.includes(w.id) || warehouseIds.includes(String(w.id)))
        : warehouses.filter(w => w.isActive);

      if (activeWarehouses.length === 0) {
        throw new Error('No active warehouses found');
      }

      const allProducts = [];
      const syncStats = {
        totalWarehouses: activeWarehouses.length,
        processedWarehouses: 0,
        totalProducts: 0,
        processedProducts: 0,
        errors: []
      };

      // Проходим по каждому складу
      for (const warehouse of activeWarehouses) {
        try {
          logger.info(`Processing warehouse: ${warehouse.name} (${warehouse.id})`);

          let currentPage = 1;
          let hasNextPage = true;

          while (hasNextPage) {
            const result = await this.getProducts({
              warehouseId: warehouse.id,
              category: 'all',
              page: currentPage,
              rows: 1000,
              brands,
              withStocks,
              withPrices,
              withSpecs
            });

            // Обрабатываем товары с ETIM данными
            const warehouseProducts = await Promise.all(
              result.products.map(async (product) => {
                try {
                  let enrichedProduct = {
                    ...product,
                    sourceWarehouse: {
                      id: warehouse.id,
                      name: warehouse.name,
                      code: warehouse.code
                    }
                  };

                  // Если нужны спецификации, получаем ETIM данные
                  if (withSpecs && product.externalId) {
                    try {
                      const specs = await this.getProductSpecs(product.externalId);

                      // Обогащаем ETIM полями из info
                      if (specs.info && (specs.info.etimClass || specs.info.etimGroup)) {
                        enrichedProduct.etim = {
                          classId: specs.info.etimClass,
                          className: specs.info.etimClassName,
                          group: specs.info.etimGroup,
                          groupName: specs.info.etimGroupName,
                        };
                      }

                      // Документы и сертификаты из specs.documents
                      if (specs.documents) {
                        enrichedProduct.documents = specs.documents;
                        if (Array.isArray(specs.documents.certificates)) {
                          enrichedProduct.certificates = specs.documents.certificates;
                        }
                      }

                    } catch (specsError) {
                      logger.warn(`Failed to get specs for product ${product.externalId}:`, specsError.message);
                      enrichedProduct.specs_error = specsError.message;
                    }
                  }

                  return enrichedProduct;
                } catch (productError) {
                  logger.warn(`Failed to process product ${product.externalId}:`, productError.message);
                  return {
                    ...product,
                    sourceWarehouse: {
                      id: warehouse.id,
                      name: warehouse.name,
                      code: warehouse.code
                    },
                    processing_error: productError.message
                  };
                }
              })
            );

            allProducts.push(...warehouseProducts);
            syncStats.totalProducts += warehouseProducts.length;

            hasNextPage = result.pagination.hasNextPage;
            currentPage++;

            await this.sleep(100);
          }

          syncStats.processedWarehouses++;

        } catch (warehouseError) {
          const error = `Warehouse ${warehouse.name}: ${warehouseError.message}`;
          syncStats.errors.push(error);
          logger.error(error);
        }
      }

      logger.info(`RS24 sync completed: ${allProducts.length} products from ${syncStats.processedWarehouses} warehouses`);

      return {
        success: true,
        products: allProducts,
        warehouses: activeWarehouses,
        stats: syncStats
      };

    } catch (error) {
      logger.error('RS24 syncProducts error:', error);
      throw new Error(`Product sync failed: ${error.message}`);
    }
  }

  /**
   * Получение списка брендов (агрегация по товарам)
   */
  async getBrands(options = {}) {
    try {
      const { pages = 5, warehouseIds = [] } = options;
      const unique = new Set();

      const warehouses = await this.getWarehouses();
      const targetWarehouses = warehouseIds.length > 0
        ? warehouses.filter(w => warehouseIds.includes(w.id) || warehouseIds.includes(String(w.id)))
        : warehouses.slice(0, 3);

      for (const warehouse of targetWarehouses) {
        logger.info(`Collecting brands from warehouse: ${warehouse.name}`);

        for (let page = 1; page <= pages; page++) {
          try {
            const result = await this.getProducts({
              warehouseId: warehouse.id,
              category: 'all',
              page,
              rows: 1000
            });

            result.products.forEach(product => {
              if (product.brand) {
                unique.add(product.brand.trim());
              }
            });

            if (!result.pagination.hasNextPage) break;

            await this.sleep(100);
          } catch (pageError) {
            logger.warn(`Error on page ${page} for warehouse ${warehouse.name}:`, pageError.message);
            break;
          }
        }
      }

      const brands = Array.from(unique).sort().map(name => ({
        name,
        code: name,
        normalizedName: name.toLowerCase()
      }));

      logger.info(`Found ${brands.length} unique brands`);
      return brands;

    } catch (error) {
      logger.error('RS24 getBrands error:', error);
      throw new Error(`Failed to get brands: ${error.message}`);
    }
  }

  /**
   * Поиск товаров
   */
  async searchProducts(query, options = {}) {
    try {
      return await this.findProductByVendorCode(query);
    } catch (error) {
      logger.error('RS24 searchProducts error:', error);
      throw new Error(`Product search failed: ${error.message}`);
    }
  }

  // ================================================================
  // ТРАНСФОРМАЦИЯ ДАННЫХ
  // ================================================================

  transformProduct(data) {
    return {
      externalId: data.CODE || data.code,
      sku: data.VENDOR_CODE || data.vendorCode,
      name: data.NAME || data.name,
      brand: data.BRAND || data.brand,
      category: data.CATEGORY || data.category,
      description: data.description || '',
      unit: data.UOM || data.uom || 'шт',
      unitOKEI: data.UOM_OKEI || data.uomOkei,
      multiplicity: data.MULTIPLICITY || data.multiplicity || 1,
      minOrderQuantity: data.MIN_ORDER_QUANTITY || 1,
      barcode: data.barcode,
      weight: data.weight ? parseFloat(data.weight) : null,
      externalData: {
        originalData: data,
        supplier: 'rs24'
      }
    };
  }

  transformProducts(products) {
    if (!Array.isArray(products)) return [];
    return products.map(product => this.transformProduct(product));
  }

  transformPrice(priceData) {
    if (!priceData) return null;

    return {
      personal: priceData.Personal,
      personalWithVAT: priceData.Personal_w_VAT,
      retail: priceData.Retail,
      retailWithVAT: priceData.Retail_w_VAT,
      mrc: priceData.MRC,
      mrcWithVAT: priceData.MRC_w_VAT,
      hasMRC: priceData.AvailabilityMRC === 'Y',
      currency: 'RUB'
    };
  }

  transformStock(stockData) {
    if (!stockData) return null;

    const result = {
      productCode: stockData.CODE || stockData.productCode,
      quantity: stockData.Residue || stockData.RESIDUE || 0,
      unit: stockData.UOM || stockData.uom,
      unitOKEI: stockData.UOM_OKEI || stockData.uomOkei,
      category: stockData.category || stockData.CATEGORY,
      qtyLots: stockData.qtyLots ? stockData.qtyLots.split(';').map(Number) : []
    };

    // Информация о партнерских остатках
    if (stockData.partnerQuantityInfo) {
      result.partnerStock = {
        quantity: stockData.partnerQuantityInfo.partnerQuantity,
        unit: stockData.partnerQuantityInfo.partnerUOM,
        unitOKEI: stockData.partnerQuantityInfo.partnerUOMOKEI,
        estimatedArrivalDate: stockData.partnerQuantityInfo.estimatedArrivalDate,
        lastUpdated: stockData.partnerQuantityInfo.partnerQuantityDate
      };
    }

    return result;
  }

  transformSpecs(specsData) {
    if (!specsData) return null;

    const info = specsData.INFO?.[0] || {};
    const specs = specsData.SPECS || [];
    const images = specsData.IMG || [];
    const videos = specsData.VIDEO || [];
    const certificates = specsData.CERTIFICATE || [];
    const barcodes = specsData.BARCODE || [];

    return {
      info: {
        description: info.DESCRIPTION,
        unit: info.PRIMARY_UOM,
        unitOKEI: info.UOM_OKEI,
        multiplicity: info.MULTIPLICITY,
        itemsPerUnit: info.ITEMS_PER_UNIT,
        etimClass: info.ETIM_CLASS,
        etimClassName: info.ETIM_CLASS_NAME,
        etimGroup: info.ETIM_GROUP,
        etimGroupName: info.ETIM_GROUP_NAME,
        vendorCode: info.VENDOR_CODE,
        brand: info.BRAND,
        itemId: info.ITEM_ID,
        series: info.SERIES,
        minpromtorgCode: info.MINPROMTORG_CODE,
        originCountry: info.ORIGIN_COUNTRY,
        warranty: info.WARRANTY,
        longDescription: info.LONG_DESCRIPTION,
        categories: info.RS_CATALOG || [],
        logisticDetails: info.LOGISTIC_DETAILS?.[0] || {}
      },
      specifications: specs.map(spec => ({
        code: spec.FEATURE_CODE,
        name: spec.NAME,
        value: spec.VALUE,
        unit: spec.UOM
      })),
      media: {
        images: images.map(img => ({ url: img.URL })),
        videos: videos.map(video => ({ url: video.URL }))
      },
      documents: {
        certificates: certificates.map(cert => ({
          url: cert.URL,
          number: cert.CERT_NUM
        })),
        catalogs: (specsData.CATALOG_BROCHURE || []).map(cat => ({ url: cat.URL })),
        passports: (specsData.PASSPORT || []).map(pass => ({ url: pass.URL }))
      },
      barcodes: barcodes.map(bc => ({
        ean: bc.EAN,
        description: bc.DESCRIPTION
      })),
      relatedItems: {
        related: (specsData.RELATED_ITEMS || []).map(item => item.RELATED_ITEM_CODE),
        similar: (specsData.SIMILAR_ITEMS || []).map(item => item.SIMILAR_ITEM_CODE)
      }
    };
  }

  // ================================================================
  // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
  // ================================================================

  async enrichProductData(products, warehouseId, options = {}) {
    const { withStocks, withPrices, withSpecs } = options;
    const enrichedProducts = [];

    for (const product of products) {
      const enriched = { ...product };

      try {
        if (withStocks) {
          enriched.stock = await this.getProductStock(warehouseId, product.externalId);
        }

        if (withPrices) {
          enriched.price = await this.getProductPrice(product.externalId);
        }

        if (withSpecs) {
          enriched.specs = await this.getProductSpecs(product.externalId);
        }

        enrichedProducts.push(enriched);
        await this.sleep(50);

      } catch (error) {
        logger.warn(`Failed to enrich product ${product.externalId}:`, error.message);
        enrichedProducts.push(enriched);
      }
    }

    return enrichedProducts;
  }

  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ================================================================
  // ТЕСТИРОВАНИЕ ПОДКЛЮЧЕНИЯ
  // ================================================================

  async testConnection() {
    try {
      const startTime = Date.now();

      const warehouses = await this.getWarehouses();

      let sampleProducts = [];
      if (warehouses.length > 0) {
        const sampleResult = await this.getProducts({
          warehouseId: warehouses[0].id,
          category: 'all',
          page: 1,
          rows: 10
        });
        sampleProducts = sampleResult.products;
      }

      const responseTime = Date.now() - startTime;

      return {
        success: true,
        message: 'RS24 connection successful',
        responseTime,
        data: {
          warehousesCount: warehouses.length,
          warehouses: warehouses.slice(0, 5).map(w => ({
            id: w.id,
            name: w.name
          })),
          sampleProductsCount: sampleProducts.length,
          rateLimitsInfo: {
            requestsInPeriod: this.requestHistory.length,
            maxRequests: this.rateLimits.maxRequestsPerPeriod,
            isBlocked: this.isBlocked
          }
        }
      };

    } catch (error) {
      logger.error('RS24 connection test failed:', error);
      return {
        success: false,
        message: error.message,
        responseTime: null
      };
    }
  }

  // ================================================================
  // ЗАГРУЗКА ДОКУМЕНТОВ
  // ================================================================

  /**
   * Загрузка документа по URL
   */
  async downloadDocument(url, documentType) {
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {
          'User-Agent': 'ModuleTrade/1.0'
        }
      });

      const fileName = `${documentType}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const fileExtension = this.getFileExtensionFromUrl(url, response.headers['content-type']);
      const fullFileName = `${fileName}${fileExtension}`;

      // Сохраняем файл локально
      const fs = require('fs').promises;
      const path = require('path');
      const uploadDir = path.join(process.cwd(), 'uploads', 'documents', 'rs24');

      await fs.mkdir(uploadDir, { recursive: true });
      const filePath = path.join(uploadDir, fullFileName);

      await fs.writeFile(filePath, response.data);

      return {
        localUrl: `/uploads/documents/rs24/${fullFileName}`,
        fileSize: response.data.length,
        mimeType: response.headers['content-type'] || 'application/octet-stream',
        originalUrl: url
      };

    } catch (error) {
      logger.error(`Error downloading document from ${url}:`, error);
      throw new Error(`Download failed: ${error.message}`);
    }
  }

  /**
   * Определение расширения файла по URL и MIME типу
   */
  getFileExtensionFromUrl(url, mimeType) {
    // Пытаемся определить по URL
    const path = require('path');
    const urlPath = new URL(url).pathname;
    const urlExtension = path.extname(urlPath);

    if (urlExtension && urlExtension.length > 1) {
      return urlExtension;
    }

    // Определяем по MIME типу
    const mimeToExt = {
      'application/pdf': '.pdf',
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'application/msword': '.doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
      'application/vnd.ms-excel': '.xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
      'text/plain': '.txt',
      'text/html': '.html'
    };

    return mimeToExt[mimeType] || '.bin';
  }

  // ================================================================
  // АУТЕНТИФИКАЦИЯ
  // ================================================================

  async authenticate() {
    try {
      await this.getWarehouses();
      return true;
    } catch (error) {
      throw new Error(`RS24 authentication failed: ${error.message}`);
    }
  }
}

module.exports = RS24Adapter;