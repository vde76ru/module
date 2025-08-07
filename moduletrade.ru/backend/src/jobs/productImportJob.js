// ===================================================
// ФАЙЛ: backend/src/jobs/productImportJob.js
// ЗАДАЧА ИМПОРТА ТОВАРОВ: Автоматический импорт от поставщиков
// ===================================================

const db = require('../config/database');
const logger = require('../utils/logger');
const ProductImportService = require('../services/ProductImportService');

class ProductImportJob {
  /**
   * Запуск запланированных импортов
   */
  static async runScheduledImports() {
    try {
      logger.info('Starting scheduled product imports...');

      // Получаем все активные компании с настроенными импортами
      const companies = await this.getCompaniesWithImports();

      for (const company of companies) {
        try {
          await this.processCompanyImports(company);
        } catch (error) {
          logger.error(`Error processing imports for company ${company.id}:`, error);
        }
      }

      logger.info('Scheduled product imports completed');

    } catch (error) {
      logger.error('Error in scheduled product imports:', error);
    }
  }

  /**
   * Получение компаний с настроенными импортами
   */
  static async getCompaniesWithImports() {
    const result = await db.query(`
      SELECT DISTINCT
        c.id,
        c.name as company_name,
        c.subscription_status
      FROM companies c
      JOIN brand_supplier_mappings bsm ON c.id = bsm.company_id
      WHERE c.subscription_status IN ('active', 'trial')
        AND c.is_active = true
    `);

    return result.rows;
  }

  /**
   * Обработка импортов для компании
   */
  static async processCompanyImports(company) {
    logger.info(`Processing imports for company: ${company.company_name}`);

    // Получаем активные маппинги брендов
    const brandMappings = await this.getActiveBrandMappings(company.id);

    for (const mapping of brandMappings) {
      try {
        await this.importBrandFromSupplier(
          company.id,
          mapping.supplier_id,
          mapping.brand_id,
          mapping.supplier_name,
          mapping.brand_name
        );
      } catch (error) {
        logger.error(`Error importing brand ${mapping.brand_name} from ${mapping.supplier_name}:`, error);
      }
    }
  }

  /**
   * Получение активных маппингов брендов
   */
  static async getActiveBrandMappings(companyId) {
    const result = await db.query(`
      SELECT
        bsm.supplier_id,
        bsm.brand_id,
        s.name as supplier_name,
        b.name as brand_name,
        s.api_type,
        s.api_config
      FROM brand_supplier_mappings bsm
      JOIN suppliers s ON bsm.supplier_id = s.id
      JOIN brands b ON bsm.brand_id = b.id
      WHERE bsm.company_id = $1
        AND bsm.is_active = true
        AND s.is_active = true
    `, [companyId]);

    return result.rows;
  }

  /**
   * Импорт бренда от поставщика
   */
  static async importBrandFromSupplier(companyId, supplierId, brandId, supplierName, brandName) {
    logger.info(`Importing brand ${brandName} from supplier ${supplierName}`);

    try {
      const importResult = await ProductImportService.importProductsByBrands(
        companyId,
        supplierId,
        [brandId],
        {
          forceUpdate: false,
          updatePrices: true,
          updateStocks: true
        }
      );

      // Логируем результат импорта
      await this.logImportResult(companyId, supplierId, brandId, importResult);

      logger.info(`Successfully imported ${importResult.imported} products for brand ${brandName}`);

    } catch (error) {
      logger.error(`Failed to import brand ${brandName}:`, error);
      
      // Логируем ошибку
      await this.logImportError(companyId, supplierId, brandId, error);
      
      throw error;
    }
  }

  /**
   * Логирование результата импорта
   */
  static async logImportResult(companyId, supplierId, brandId, result) {
    try {
      await db.query(`
        INSERT INTO import_logs (
          company_id, supplier_id, brand_id, import_type,
          products_imported, products_updated, errors_count,
          status, started_at, completed_at, metadata
        ) VALUES (
          $1, $2, $3, 'scheduled', $4, $5, $6, 'completed',
          NOW(), NOW(), $7
        )
      `, [
        companyId,
        supplierId,
        brandId,
        result.imported || 0,
        result.updated || 0,
        result.errors?.length || 0,
        JSON.stringify(result)
      ]);

    } catch (error) {
      logger.error('Error logging import result:', error);
    }
  }

  /**
   * Логирование ошибки импорта
   */
  static async logImportError(companyId, supplierId, brandId, error) {
    try {
      await db.query(`
        INSERT INTO import_logs (
          company_id, supplier_id, brand_id, import_type,
          products_imported, products_updated, errors_count,
          status, started_at, completed_at, error_message
        ) VALUES (
          $1, $2, $3, 'scheduled', 0, 0, 1, 'failed',
          NOW(), NOW(), $4
        )
      `, [
        companyId,
        supplierId,
        brandId,
        error.message
      ]);

    } catch (logError) {
      logger.error('Error logging import error:', logError);
    }
  }

  /**
   * Принудительный импорт для конкретной компании
   */
  static async forceImportForCompany(companyId) {
    try {
      logger.info(`Starting forced import for company ${companyId}`);

      const company = await this.getCompanyById(companyId);
      if (!company) {
        throw new Error('Company not found');
      }

      await this.processCompanyImports(company);

      logger.info(`Forced import completed for company ${companyId}`);

    } catch (error) {
      logger.error(`Error in forced import for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Получение компании по ID
   */
  static async getCompanyById(companyId) {
    const result = await db.query(`
      SELECT id, name as company_name, subscription_status
      FROM companies
      WHERE id = $1 AND is_active = true
    `, [companyId]);

    return result.rows[0] || null;
  }

  /**
   * Получение статистики импортов
   */
  static async getImportStats(companyId, days = 30) {
    const result = await db.query(`
      SELECT
        COUNT(*) as total_imports,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_imports,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_imports,
        SUM(products_imported) as total_products_imported,
        SUM(products_updated) as total_products_updated,
        AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration_seconds
      FROM import_logs
      WHERE company_id = $1
        AND started_at >= NOW() - INTERVAL '${days} days'
    `, [companyId]);

    return result.rows[0];
  }
}

module.exports = ProductImportJob; 