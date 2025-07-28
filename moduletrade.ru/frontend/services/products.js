// frontend/src/services/products.js
import axios from '../utils/axios';
import { API_ENDPOINTS } from '../utils/constants';

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
   * Массовое обновление товаров
   */
  async bulkUpdateProducts(productIds, updateData) {
    try {
      const response = await axios.post(`${API_ENDPOINTS.PRODUCTS}/bulk-update`, {
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
      const response = await axios.post(`${API_ENDPOINTS.PRODUCTS}/bulk-delete`, {
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
      
      // Добавляем опции импорта
      Object.keys(options).forEach(key => {
        formData.append(key, options[key]);
      });

      const response = await axios.post(API_ENDPOINTS.PRODUCTS_IMPORT, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 300000, // 5 минут для импорта
      });
      
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Экспорт товаров
   */
  async exportProducts(format = 'yml', filters = {}) {
    try {
      const params = { format, ...filters };
      
      const response = await axios.get(`${API_ENDPOINTS.PRODUCTS_EXPORT}/${format}`, {
        params,
        responseType: 'blob',
        timeout: 180000, // 3 минуты для экспорта
      });

      // Создаем файл для скачивания
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Определяем имя файла
      const filename = this.getExportFilename(format);
      link.download = filename;
      
      // Скачиваем файл
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      return { success: true, filename };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Получение статуса импорта
   */
  async getImportStatus(importId) {
    try {
      const response = await axios.get(`${API_ENDPOINTS.PRODUCTS_IMPORT}/${importId}/status`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Отмена импорта
   */
  async cancelImport(importId) {
    try {
      const response = await axios.post(`${API_ENDPOINTS.PRODUCTS_IMPORT}/${importId}/cancel`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Получение шаблона для импорта
   */
  async getImportTemplate(format = 'xlsx') {
    try {
      const response = await axios.get(`${API_ENDPOINTS.PRODUCTS_IMPORT}/template`, {
        params: { format },
        responseType: 'blob',
      });

      // Создаем файл для скачивания
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `products_template.${format}`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      return { success: true };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Поиск товаров
   */
  async searchProducts(query, filters = {}) {
    try {
      const params = { search: query, ...filters };
      const response = await axios.get(`${API_ENDPOINTS.PRODUCTS}/search`, { params });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Получение похожих товаров
   */
  async getSimilarProducts(productId, limit = 10) {
    try {
      const response = await axios.get(`${API_ENDPOINTS.PRODUCTS}/${productId}/similar`, {
        params: { limit },
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Получение истории изменений товара
   */
  async getProductHistory(productId) {
    try {
      const response = await axios.get(`${API_ENDPOINTS.PRODUCTS}/${productId}/history`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Загрузка изображений товара
   */
  async uploadProductImages(productId, files) {
    try {
      const formData = new FormData();
      
      files.forEach((file, index) => {
        formData.append(`images[${index}]`, file);
      });

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
   * Получение категорий товаров
   */
  async getCategories() {
    try {
      const response = await axios.get('/dictionaries/categories');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Получение брендов
   */
  async getBrands() {
    try {
      const response = await axios.get('/dictionaries/brands');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Получение поставщиков
   */
  async getSuppliers() {
    try {
      const response = await axios.get('/dictionaries/suppliers');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Получение атрибутов товаров
   */
  async getAttributes() {
    try {
      const response = await axios.get('/dictionaries/attributes');
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
   * Получение статистики по товарам
   */
  async getProductsStats(filters = {}) {
    try {
      const response = await axios.get(`${API_ENDPOINTS.PRODUCTS}/stats`, { params: filters });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Копирование товара
   */
  async duplicateProduct(productId) {
    try {
      const response = await axios.post(`${API_ENDPOINTS.PRODUCTS}/${productId}/duplicate`);
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
  async restoreProduct(productId) {
    try {
      const response = await axios.post(`${API_ENDPOINTS.PRODUCTS}/${productId}/restore`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Вспомогательные методы

  /**
   * Получение имени файла для экспорта
   */
  getExportFilename(format) {
    const date = new Date().toISOString().split('T')[0];
    const extensions = {
      yml: 'yml',
      xlsx: 'xlsx',
      csv: 'csv',
      xml: 'xml',
      json: 'json',
    };
    
    const extension = extensions[format] || 'txt';
    return `products_export_${date}.${extension}`;
  }

  /**
   * Форматирование данных товара для отправки
   */
  formatProductData(data) {
    return {
      ...data,
      price: data.price ? parseFloat(data.price) : null,
      quantity: data.quantity ? parseInt(data.quantity, 10) : 0,
      weight: data.weight ? parseFloat(data.weight) : null,
      is_active: Boolean(data.is_active),
    };
  }

  /**
   * Обработка ошибок
   */
  handleError(error) {
    if (error.response) {
      const { status, data } = error.response;
      
      switch (status) {
        case 404:
          return new Error('Товар не найден');
        case 409:
          return new Error('Товар с таким артикулом уже существует');
        case 422:
          const errors = data.errors || {};
          const errorMessages = Object.values(errors).flat();
          return new Error(errorMessages.join(', ') || 'Ошибка валидации данных товара');
        default:
          return new Error(data.message || 'Ошибка при работе с товарами');
      }
    } else if (error.request) {
      return new Error('Ошибка сети при работе с товарами');
    } else {
      return new Error(error.message || 'Неизвестная ошибка');
    }
  }
}

// Создаем и экспортируем экземпляр сервиса
const productsService = new ProductsService();
export default productsService;