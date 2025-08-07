const db = require('../config/database');
const logger = require('../utils/logger');

class AttributeMappingService {
  /**
   * Автоматический маппинг атрибутов
   */
  static async autoMapAttributes(companyId, supplierId, attributes) {
    const mappedAttributes = {};
    
    for (const [key, value] of Object.entries(attributes)) {
      // Ищем существующий маппинг
      const existingMapping = await this.findAttributeMapping(companyId, supplierId, key);
      
      if (existingMapping) {
        mappedAttributes[existingMapping.internal_name] = {
          value: await this.convertAttributeValue(value, existingMapping),
          original_key: key,
          original_value: value
        };
      } else {
        // Пытаемся найти похожий атрибут
        const similarAttribute = await this.findSimilarAttribute(companyId, key, value);
        
        if (similarAttribute) {
          // Создаем автоматический маппинг
          await this.createAttributeMapping(companyId, supplierId, key, similarAttribute.name);
          
          mappedAttributes[similarAttribute.name] = {
            value: await this.convertAttributeValue(value, similarAttribute),
            original_key: key,
            original_value: value,
            auto_mapped: true
          };
        } else {
          // Сохраняем как неизвестный атрибут
          mappedAttributes[`unknown_${key}`] = {
            value: value,
            original_key: key,
            original_value: value,
            unmapped: true
          };
        }
      }
    }
    
    return mappedAttributes;
  }

  /**
   * Поиск существующего маппинга атрибута
   */
  static async findAttributeMapping(companyId, supplierId, externalKey) {
    const query = `
      SELECT * FROM attribute_mappings 
      WHERE company_id = $1 AND supplier_id = $2 AND external_key = $3 AND is_active = true
    `;
    
    const result = await db.query(query, [companyId, supplierId, externalKey]);
    return result.rows[0];
  }

  /**
   * Поиск похожего атрибута
   */
  static async findSimilarAttribute(companyId, externalKey, externalValue) {
    // Ищем по названию атрибута
    const query = `
      SELECT * FROM product_attributes 
      WHERE company_id = $1 
        AND (name ILIKE $2 OR display_name ILIKE $2)
        AND is_active = true
      LIMIT 1
    `;
    
    const result = await db.query(query, [companyId, `%${externalKey}%`]);
    
    if (result.rows.length > 0) {
      return result.rows[0];
    }
    
    // Ищем по значению (для категориальных атрибутов)
    const valueQuery = `
      SELECT pa.* FROM product_attributes pa
      JOIN attribute_values av ON pa.id = av.attribute_id
      WHERE pa.company_id = $1 
        AND av.value ILIKE $2
        AND pa.is_active = true
      LIMIT 1
    `;
    
    const valueResult = await db.query(valueQuery, [companyId, `%${externalValue}%`]);
    return valueResult.rows[0];
  }

  /**
   * Конвертация значения атрибута
   */
  static async convertAttributeValue(value, attributeMapping) {
    if (!attributeMapping.conversion_rules) {
      return value;
    }
    
    const rules = attributeMapping.conversion_rules;
    let convertedValue = value;
    
    // Применяем правила конвертации
    for (const rule of rules) {
      switch (rule.type) {
        case 'unit_conversion':
          convertedValue = await this.convertUnit(value, rule.from_unit, rule.to_unit);
          break;
          
        case 'value_mapping':
          const mappedValue = rule.mapping[value];
          if (mappedValue) {
            convertedValue = mappedValue;
          }
          break;
          
        case 'format_conversion':
          convertedValue = await this.convertFormat(value, rule.format);
          break;
      }
    }
    
    return convertedValue;
  }

  /**
   * Конвертация единиц измерения
   */
  static async convertUnit(value, fromUnit, toUnit) {
    const conversions = {
      'mm_to_cm': (val) => val / 10,
      'cm_to_mm': (val) => val * 10,
      'g_to_kg': (val) => val / 1000,
      'kg_to_g': (val) => val * 1000,
      'ml_to_l': (val) => val / 1000,
      'l_to_ml': (val) => val * 1000
    };
    
    const conversionKey = `${fromUnit}_to_${toUnit}`;
    const converter = conversions[conversionKey];
    
    if (converter && !isNaN(value)) {
      return converter(parseFloat(value));
    }
    
    return value;
  }

  /**
   * Конвертация формата
   */
  static async convertFormat(value, format) {
    switch (format) {
      case 'uppercase':
        return value.toString().toUpperCase();
      case 'lowercase':
        return value.toString().toLowerCase();
      case 'capitalize':
        return value.toString().replace(/\b\w/g, l => l.toUpperCase());
      case 'remove_spaces':
        return value.toString().replace(/\s+/g, '');
      default:
        return value;
    }
  }

  /**
   * Создание маппинга атрибута
   */
  static async createAttributeMapping(companyId, supplierId, externalKey, internalName, options = {}) {
    const query = `
      INSERT INTO attribute_mappings (
        company_id, supplier_id, external_key, internal_name, 
        conversion_rules, is_auto_mapped, is_active, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, true, now(), now())
      ON CONFLICT (company_id, supplier_id, external_key)
      DO UPDATE SET 
        internal_name = EXCLUDED.internal_name,
        conversion_rules = EXCLUDED.conversion_rules,
        is_auto_mapped = EXCLUDED.is_auto_mapped,
        updated_at = now()
    `;
    
    await db.query(query, [
      companyId, supplierId, externalKey, internalName,
      options.conversion_rules || null,
      options.is_auto_mapped || false
    ]);
  }

  /**
   * Маппинг категорий
   */
  static async mapCategories(companyId, supplierId, externalCategories) {
    const mappedCategories = {};
    
    for (const externalCategory of externalCategories) {
      // Ищем существующий маппинг
      const existingMapping = await this.findCategoryMapping(companyId, supplierId, externalCategory.id);
      
      if (existingMapping) {
        mappedCategories[existingMapping.internal_category_id] = {
          original_id: externalCategory.id,
          original_name: externalCategory.name,
          mapped_name: existingMapping.internal_category_name
        };
      } else {
        // Пытаемся найти похожую категорию
        const similarCategory = await this.findSimilarCategory(companyId, externalCategory.name);
        
        if (similarCategory) {
          // Создаем автоматический маппинг
          await this.createCategoryMapping(companyId, supplierId, externalCategory.id, similarCategory.id);
          
          mappedCategories[similarCategory.id] = {
            original_id: externalCategory.id,
            original_name: externalCategory.name,
            mapped_name: similarCategory.name,
            auto_mapped: true
          };
        } else {
          // Создаем новую категорию
          const newCategory = await this.createCategory(companyId, externalCategory.name);
          
          await this.createCategoryMapping(companyId, supplierId, externalCategory.id, newCategory.id);
          
          mappedCategories[newCategory.id] = {
            original_id: externalCategory.id,
            original_name: externalCategory.name,
            mapped_name: newCategory.name,
            newly_created: true
          };
        }
      }
    }
    
    return mappedCategories;
  }

  /**
   * Поиск маппинга категории
   */
  static async findCategoryMapping(companyId, supplierId, externalCategoryId) {
    const query = `
      SELECT cm.*, c.name as internal_category_name
      FROM category_mappings cm
      JOIN categories c ON cm.internal_category_id = c.id
      WHERE cm.company_id = $1 AND cm.supplier_id = $2 
        AND cm.external_category_id = $3 AND cm.is_active = true
    `;
    
    const result = await db.query(query, [companyId, supplierId, externalCategoryId]);
    return result.rows[0];
  }

  /**
   * Поиск похожей категории
   */
  static async findSimilarCategory(companyId, externalCategoryName) {
    const query = `
      SELECT * FROM categories 
      WHERE company_id = $1 
        AND (name ILIKE $2 OR name ILIKE $3)
        AND is_active = true
      LIMIT 1
    `;
    
    const result = await db.query(query, [
      companyId, 
      `%${externalCategoryName}%`,
      `%${externalCategoryName.replace(/\s+/g, '%')}%`
    ]);
    
    return result.rows[0];
  }

  /**
   * Создание маппинга категории
   */
  static async createCategoryMapping(companyId, supplierId, externalCategoryId, internalCategoryId, options = {}) {
    const query = `
      INSERT INTO category_mappings (
        company_id, supplier_id, external_category_id, internal_category_id,
        is_auto_mapped, is_active, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, true, now(), now())
      ON CONFLICT (company_id, supplier_id, external_category_id)
      DO UPDATE SET 
        internal_category_id = EXCLUDED.internal_category_id,
        is_auto_mapped = EXCLUDED.is_auto_mapped,
        updated_at = now()
    `;
    
    await db.query(query, [
      companyId, supplierId, externalCategoryId, internalCategoryId,
      options.is_auto_mapped || false
    ]);
  }

  /**
   * Создание новой категории
   */
  static async createCategory(companyId, name, parentId = null) {
    const query = `
      INSERT INTO categories (company_id, name, parent_id, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, true, now(), now())
      RETURNING *
    `;
    
    const result = await db.query(query, [companyId, name, parentId]);
    return result.rows[0];
  }

  /**
   * Получение всех маппингов для поставщика
   */
  static async getSupplierMappings(companyId, supplierId) {
    const attributeQuery = `
      SELECT * FROM attribute_mappings 
      WHERE company_id = $1 AND supplier_id = $2 AND is_active = true
      ORDER BY external_key
    `;
    
    const categoryQuery = `
      SELECT cm.*, c.name as internal_category_name, 
             ec.name as external_category_name
      FROM category_mappings cm
      JOIN categories c ON cm.internal_category_id = c.id
      LEFT JOIN external_categories ec ON cm.external_category_id = ec.id
      WHERE cm.company_id = $1 AND cm.supplier_id = $2 AND cm.is_active = true
      ORDER BY ec.name
    `;
    
    const [attributeResult, categoryResult] = await Promise.all([
      db.query(attributeQuery, [companyId, supplierId]),
      db.query(categoryQuery, [companyId, supplierId])
    ]);
    
    return {
      attributes: attributeResult.rows,
      categories: categoryResult.rows
    };
  }

  /**
   * Обновление маппинга атрибута
   */
  static async updateAttributeMapping(companyId, supplierId, externalKey, updates) {
    const query = `
      UPDATE attribute_mappings 
      SET internal_name = $4, conversion_rules = $5, updated_at = now()
      WHERE company_id = $1 AND supplier_id = $2 AND external_key = $3
    `;
    
    await db.query(query, [
      companyId, supplierId, externalKey,
      updates.internal_name, updates.conversion_rules
    ]);
  }

  /**
   * Обновление маппинга категории
   */
  static async updateCategoryMapping(companyId, supplierId, externalCategoryId, internalCategoryId) {
    const query = `
      UPDATE category_mappings 
      SET internal_category_id = $4, updated_at = now()
      WHERE company_id = $1 AND supplier_id = $2 AND external_category_id = $3
    `;
    
    await db.query(query, [companyId, supplierId, externalCategoryId, internalCategoryId]);
  }
}

module.exports = AttributeMappingService; 