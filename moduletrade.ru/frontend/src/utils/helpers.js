// frontend/src/utils/helpers.js

/**
 * Форматирование валюты
 */
export const formatCurrency = (value, currency = 'RUB', locale = 'ru-RU') => {
  if (value === null || value === undefined || isNaN(value)) {
    return '0 ₽';
  }
  
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value));
};

/**
 * Форматирование чисел с разделителями
 */
export const formatNumber = (value, locale = 'ru-RU') => {
  if (value === null || value === undefined || isNaN(value)) {
    return '0';
  }
  
  return new Intl.NumberFormat(locale).format(Number(value));
};

/**
 * Форматирование даты
 */
export const formatDate = (date, options = {}) => {
  if (!date) return '';
  
  const defaultOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...options
  };
  
  return new Date(date).toLocaleDateString('ru-RU', defaultOptions);
};

/**
 * Форматирование времени
 */
export const formatDateTime = (date, options = {}) => {
  if (!date) return '';
  
  const defaultOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    ...options
  };
  
  return new Date(date).toLocaleString('ru-RU', defaultOptions);
};

/**
 * Получение относительного времени (например, "2 часа назад")
 */
export const getRelativeTime = (date) => {
  if (!date) return '';
  
  const now = new Date();
  const target = new Date(date);
  const diffMs = now - target;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffMinutes < 1) return 'только что';
  if (diffMinutes < 60) return `${diffMinutes} мин. назад`;
  if (diffHours < 24) return `${diffHours} ч. назад`;
  if (diffDays < 7) return `${diffDays} дн. назад`;
  
  return formatDate(date);
};

/**
 * Обрезка текста с многоточием
 */
export const truncateText = (text, maxLength = 100) => {
  if (!text || text.length <= maxLength) {
    return text;
  }
  
  return text.substring(0, maxLength) + '...';
};

/**
 * Генерация случайного ID
 */
export const generateId = () => {
  return Math.random().toString(36).substr(2, 9);
};

/**
 * Debounce функция
 */
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Throttle функция
 */
export const throttle = (func, limit) => {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

/**
 * Копирование текста в буфер обмена
 */
export const copyToClipboard = async (text) => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // Fallback для старых браузеров
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      const result = document.execCommand('copy');
      textArea.remove();
      return result;
    }
  } catch (error) {
    console.error('Failed to copy text: ', error);
    return false;
  }
};

/**
 * Загрузка файла
 */
export const downloadFile = (url, filename) => {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || 'download';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Валидация email
 */
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Валидация телефона (российский формат)
 */
export const isValidPhone = (phone) => {
  const phoneRegex = /^(\+7|7|8)?[\s\-]?\(?[489][0-9]{2}\)?[\s\-]?[0-9]{3}[\s\-]?[0-9]{2}[\s\-]?[0-9]{2}$/;
  return phoneRegex.test(phone);
};

/**
 * Форматирование телефона
 */
export const formatPhone = (phone) => {
  if (!phone) return '';
  
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.length === 11 && cleaned.startsWith('8')) {
    return `+7 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7, 9)}-${cleaned.slice(9)}`;
  } else if (cleaned.length === 11 && cleaned.startsWith('7')) {
    return `+7 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7, 9)}-${cleaned.slice(9)}`;
  } else if (cleaned.length === 10) {
    return `+7 (${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 8)}-${cleaned.slice(8)}`;
  }
  
  return phone;
};

/**
 * Получение цвета для статуса
 */
export const getStatusColor = (status) => {
  const statusColors = {
    // Общие статусы
    active: 'success',
    inactive: 'default',
    pending: 'warning',
    processing: 'processing',
    completed: 'success',
    failed: 'error',
    cancelled: 'error',
    
    // Статусы заказов
    new: 'blue',
    confirmed: 'cyan',
    shipped: 'geekblue',
    delivered: 'green',
    returned: 'orange',
    refunded: 'red',
    
    // Статусы синхронизации
    success: 'success',
    error: 'error',
    warning: 'warning',
    
    // Статусы товаров
    draft: 'default',
    published: 'success',
    archived: 'default',
  };
  
  return statusColors[status] || 'default';
};

/**
 * Получение иконки для статуса
 */
export const getStatusIcon = (status) => {
  const statusIcons = {
    active: 'check-circle',
    inactive: 'minus-circle',
    pending: 'clock-circle',
    processing: 'loading',
    completed: 'check-circle',
    failed: 'close-circle',
    cancelled: 'stop',
    
    new: 'file-add',
    confirmed: 'check',
    shipped: 'car',
    delivered: 'check-circle',
    returned: 'rollback',
    refunded: 'dollar',
    
    success: 'check-circle',
    error: 'exclamation-circle',
    warning: 'warning',
    
    draft: 'edit',
    published: 'eye',
    archived: 'folder',
  };
  
  return statusIcons[status] || 'question-circle';
};

/**
 * Конвертация размера файла в читаемый формат
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Проверка типа файла по расширению
 */
export const getFileType = (filename) => {
  if (!filename) return 'unknown';
  
  const extension = filename.split('.').pop().toLowerCase();
  
  const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
  const documentTypes = ['pdf', 'doc', 'docx', 'txt', 'rtf'];
  const spreadsheetTypes = ['xls', 'xlsx', 'csv'];
  const archiveTypes = ['zip', 'rar', '7z', 'tar', 'gz'];
  
  if (imageTypes.includes(extension)) return 'image';
  if (documentTypes.includes(extension)) return 'document';
  if (spreadsheetTypes.includes(extension)) return 'spreadsheet';
  if (archiveTypes.includes(extension)) return 'archive';
  
  return 'unknown';
};

/**
 * Сортировка массива объектов
 */
export const sortBy = (array, key, direction = 'asc') => {
  return [...array].sort((a, b) => {
    const aValue = a[key];
    const bValue = b[key];
    
    if (aValue < bValue) {
      return direction === 'asc' ? -1 : 1;
    }
    if (aValue > bValue) {
      return direction === 'asc' ? 1 : -1;
    }
    return 0;
  });
};

/**
 * Группировка массива по ключу
 */
export const groupBy = (array, key) => {
  return array.reduce((groups, item) => {
    const group = item[key];
    if (!groups[group]) {
      groups[group] = [];
    }
    groups[group].push(item);
    return groups;
  }, {});
};

/**
 * Удаление дубликатов из массива
 */
export const unique = (array, key = null) => {
  if (key) {
    const seen = new Set();
    return array.filter(item => {
      const value = item[key];
      if (seen.has(value)) {
        return false;
      }
      seen.add(value);
      return true;
    });
  }
  
  return [...new Set(array)];
};

/**
 * Глубокое клонирование объекта
 */
export const deepClone = (obj) => {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }
  
  if (obj instanceof Array) {
    return obj.map(item => deepClone(item));
  }
  
  if (typeof obj === 'object') {
    const cloned = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned;
  }
  
  return obj;
};

/**
 * Проверка, является ли объект пустым
 */
export const isEmpty = (obj) => {
  if (obj === null || obj === undefined) return true;
  if (typeof obj === 'string' || Array.isArray(obj)) return obj.length === 0;
  if (typeof obj === 'object') return Object.keys(obj).length === 0;
  return false;
};