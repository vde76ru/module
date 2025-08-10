// ===================================================
// ФАЙЛ: frontend/src/services/products.js
// ОБНОВЛЕННЫЙ PRODUCTSSERVICE С ЕДИНЫМ AXIOS
// ===================================================
import axios from '../utils/axios';
import { API_ENDPOINTS } from 'utils/constants';

class ProductsService {

  /**
   * Получение списка товаров с фильтрацией и пагинацией
   */
  async getProducts(params = {}) {
    try {
      const response = await axios.get(API_ENDPOINTS.PRODUCTS, { params });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Получение товара по ID
   */
  async getProduct(id) {
    try {
      const response = await axios.get(`${API_ENDPOINTS.PRODUCTS}/${id}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Создание нового товара
   */
  async createProduct(productData) {
    try {
      const response = await axios.post(API_ENDPOINTS.PRODUCTS, productData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Обновление товара
   */
  async updateProduct(id, productData) {
    try {
      const response = await axios.put(`${API_ENDPOINTS.PRODUCTS}/${id}`, productData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Удаление товара
   */
  async deleteProduct(id) {
    try {
      const response = await axios.delete(`${API_ENDPOINTS.PRODUCTS}/${id}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Поиск товаров
   */
  async searchProducts(query, params = {}) {
    try {
      const response = await axios.get(API_ENDPOINTS.PRODUCTS_SEARCH, {
        params: { q: query, ...params }
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Массовое обновление товаров
   */
  async bulkUpdateProducts(productIds, updateData) {
    try {
      const response = await axios.post(API_ENDPOINTS.PRODUCTS_BULK_UPDATE, {
        product_ids: productIds,
        updates: updateData,
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Массовое удаление товаров
   */
  async bulkDeleteProducts(productIds) {
    try {
      const response = await axios.post(API_ENDPOINTS.PRODUCTS_BULK_DELETE, {
        product_ids: productIds,
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Импорт товаров из файла
   */
  async importProducts(file, options = {}) {
    try {
      const formData = new FormData();
      formData.append('file', file);

      // Добавляем дополнительные опции
      Object.keys(options).forEach(key => {
        formData.append(key, options[key]);
      });

      const response = await axios.post(API_ENDPOINTS.PRODUCTS_IMPORT, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 120000, // Увеличиваем timeout для импорта
      });

      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Экспорт товаров
   */
  async exportProducts(params = {}, format = 'xlsx') {
    try {
      const response = await axios.get(API_ENDPOINTS.PRODUCTS_EXPORT, {
        params: { ...params, format },
        responseType: 'blob', // Важно для скачивания файлов
        timeout: 120000, // Увеличиваем timeout для экспорта
      });

      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Получение статистики товаров
   */
  async getProductsStats(params = {}) {
    try {
      const response = await axios.get(`${API_ENDPOINTS.PRODUCTS}/stats`, { params });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Получение категорий товаров
   */
  async getCategories() {
    try {
      const response = await axios.get(API_ENDPOINTS.PRODUCTS_CATEGORIES);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Получение брендов товаров
   */
  async getBrands() {
    try {
      const response = await axios.get(`${API_ENDPOINTS.PRODUCTS}/brands`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Получение поставщиков товара
   */
  async getProductSuppliers(productId) {
    try {
      const response = await axios.get(`${API_ENDPOINTS.PRODUCTS}/${productId}/suppliers`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Добавление поставщика к товару
   */
  async addProductSupplier(productId, supplierData) {
    try {
      const response = await axios.post(
        `${API_ENDPOINTS.PRODUCTS}/${productId}/suppliers`,
        supplierData
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Обновление связи товар-поставщик
   */
  async updateProductSupplier(productId, supplierId, supplierData) {
    try {
      const response = await axios.put(
        `${API_ENDPOINTS.PRODUCTS}/${productId}/suppliers/${supplierId}`,
        supplierData
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Удаление поставщика товара
   */
  async removeProductSupplier(productId, supplierId) {
    try {
      const response = await axios.delete(
        `${API_ENDPOINTS.PRODUCTS}/${productId}/suppliers/${supplierId}`
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Получение истории изменений товара
   */
  async getProductHistory(productId, params = {}) {
    try {
      const response = await axios.get(
        `${API_ENDPOINTS.PRODUCTS}/${productId}/history`,
        { params }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Получение остатков товара по складам
   */
  async getProductStock(productId) {
    try {
      const response = await axios.get(`${API_ENDPOINTS.PRODUCTS}/${productId}/stock`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Обновление остатков товара
   */
  async updateProductStock(productId, stockData) {
    try {
      const response = await axios.put(
        `${API_ENDPOINTS.PRODUCTS}/${productId}/stock`,
        stockData
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Синхронизация товара с внешними источниками
   */
  async syncProduct(productId, sources = []) {
    try {
      const response = await axios.post(`${API_ENDPOINTS.PRODUCTS}/${productId}/sync`, {
        sources
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Получение рекомендаций по ценообразованию
   */
  async getPricingRecommendations(productId) {
    try {
      const response = await axios.get(`${API_ENDPOINTS.PRODUCTS}/${productId}/pricing`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Дублирование товара
   */
  async duplicateProduct(productId, duplicateData = {}) {
    try {
      const response = await axios.post(
        `${API_ENDPOINTS.PRODUCTS}/${productId}/duplicate`,
        duplicateData
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Архивирование товара
   */
  async archiveProduct(productId) {
    try {
      const response = await axios.post(`${API_ENDPOINTS.PRODUCTS}/${productId}/archive`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Восстановление товара из архива
   */
  async unarchiveProduct(productId) {
    try {
      const response = await axios.post(`${API_ENDPOINTS.PRODUCTS}/${productId}/unarchive`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Загрузка изображений товара
   */
  async uploadProductImages(productId, images) {
    try {
      const formData = new FormData();

      // Добавляем файлы изображений
      if (Array.isArray(images)) {
        images.forEach((image, index) => {
          formData.append(`images[${index}]`, image);
        });
      } else {
        formData.append('image', images);
      }

      const response = await axios.post(
        `${API_ENDPOINTS.PRODUCTS}/${productId}/images`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Добавление изображений по URL
   */
  async addProductImageUrls(productId, urls = [], alt = null) {
    try {
      const response = await axios.post(
        `${API_ENDPOINTS.PRODUCTS}/${productId}/image-urls`,
        { urls, alt }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Получить изображения товара
   */
  async getProductImages(productId) {
    try {
      const response = await axios.get(`${API_ENDPOINTS.PRODUCTS}/${productId}/images`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Обновить порядок и главную картинку
   */
  async sortProductImages(productId, imageOrder = [], mainImageId = null) {
    try {
      const response = await axios.put(
        `${API_ENDPOINTS.PRODUCTS}/${productId}/images/sort`,
        { order: imageOrder, mainImageId }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Удаление изображения товара
   */
  async deleteProductImage(productId, imageId) {
    try {
      const response = await axios.delete(
        `${API_ENDPOINTS.PRODUCTS}/${productId}/images/${imageId}`
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Проверка уникальности SKU
   */
  async checkSkuUnique(sku, excludeProductId = null) {
    try {
      const params = { sku };
      if (excludeProductId) {
        params.exclude_id = excludeProductId;
      }

      const response = await axios.get(`${API_ENDPOINTS.PRODUCTS}/check-sku`, { params });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Валидация данных товара
   */
  async validateProduct(productData) {
    try {
      const response = await axios.post(`${API_ENDPOINTS.PRODUCTS}/validate`, productData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Обработка ошибок API
   */
  handleError(error) {
    const errorMessage = error.response?.data?.message ||
                        error.response?.data?.error ||
                        error.message ||
                        'Произошла неизвестная ошибка';

    // В development режиме выводим подробную информацию об ошибке
    if (process.env.NODE_ENV === 'development') {
      console.error('Products Service Error:', {
        message: errorMessage,
        status: error.response?.status,
        data: error.response?.data,
      });
    }

    return new Error(errorMessage);
  }

  /**
   * Создание URL для изображения товара
   */
  getImageUrl(imagePath) {
    return axios.createFileUrl(imagePath);
  }

  /**
   * Фильтрация товаров по множественным критериям
   */
  buildFilterParams(filters) {
    const params = {};

    if (filters.search) params.search = filters.search;
    if (filters.category) params.category = filters.category;
    if (filters.brand) params.brand = filters.brand;
    if (filters.status) params.status = filters.status;
    if (filters.priceMin) params.price_min = filters.priceMin;
    if (filters.priceMax) params.price_max = filters.priceMax;
    if (filters.inStock !== undefined) params.in_stock = filters.inStock;
    if (filters.supplier) params.supplier = filters.supplier;
    if (filters.sortBy) params.sort_by = filters.sortBy;
    if (filters.sortOrder) params.sort_order = filters.sortOrder;
    if (filters.page) params.page = filters.page;
    if (filters.limit) params.limit = filters.limit;

    return params;
  }
}

// Создаем единый экземпляр
const productsService = new ProductsService();

export default productsService;