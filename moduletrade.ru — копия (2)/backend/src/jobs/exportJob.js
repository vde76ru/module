// ===================================================
// ФАЙЛ: backend/src/jobs/exportJob.js
// ЭКСПОРТ ДАННЫХ: Генерация файлов экспорта по фильтрам
// ===================================================

const fs = require('fs');
const path = require('path');
const db = require('../config/database');
const logger = require('../utils/logger');

class ExportJob {
  /**
   * Выполнить экспорт по настройкам
   * settings: {
   *   file_type: 'csv' | 'json',
   *   include: ['products','prices','stocks',...],
   *   filters: { brand_ids: [], category_ids: [], supplier_id, updated_since, only_in_stock, ... }
   * }
   */
  static async runExport(companyId, settings = {}) {
    const fileType = settings.file_type || 'csv';
    const include = Array.isArray(settings.include) ? settings.include : ['products'];
    const filters = settings.filters || {};

    try {
      logger.info(`Starting export for company ${companyId} with type ${fileType}`);

      const rows = await this.fetchData(companyId, include, filters);

      const exportDir = path.resolve(process.cwd(), 'uploads', 'exports');
      await fs.promises.mkdir(exportDir, { recursive: true });

      const fileName = `export_${companyId}_${Date.now()}.${fileType === 'json' ? 'json' : 'csv'}`;
      const filePath = path.join(exportDir, fileName);

      if (fileType === 'json') {
        await fs.promises.writeFile(filePath, JSON.stringify(rows, null, 2), 'utf-8');
      } else {
        const csv = this.toCSV(rows);
        await fs.promises.writeFile(filePath, csv, 'utf-8');
      }

      logger.info(`Export file created: ${filePath}`);

      return { success: true, file: `/uploads/exports/${fileName}`, count: rows.length };
    } catch (error) {
      logger.error('Export job failed:', error);
      throw error;
    }
  }

  static async fetchData(companyId, include, filters) {
    // Упрощенный набор колонок, фильтрация по брендам/категориям/поставщику
    const conditions = ['p.company_id = $1'];
    const params = [companyId];
    let idx = 2;

    if (filters.brand_ids?.length) {
      conditions.push(`p.brand_id = ANY($${idx++})`);
      params.push(filters.brand_ids);
    }
    if (filters.category_ids?.length) {
      conditions.push(`p.category_id = ANY($${idx++})`);
      params.push(filters.category_ids);
    }
    if (filters.supplier_id) {
      conditions.push(`p.main_supplier_id = $${idx++}`);
      params.push(filters.supplier_id);
    }
    if (filters.updated_since) {
      conditions.push(`p.updated_at >= $${idx++}`);
      params.push(new Date(filters.updated_since));
    }
    if (filters.only_in_stock === true) {
      conditions.push(`EXISTS (SELECT 1 FROM warehouse_product_links w WHERE w.product_id = p.id AND w.available_quantity > 0)`);
    }

    const baseQuery = `
      SELECT
        p.id, p.name, p.internal_code, p.sku, p.external_id,
        p.brand_id, p.category_id, p.main_supplier_id,
        COALESCE(pr.value, 0) as supplier_price,
        COALESCE(w.available_quantity, 0) as stock_quantity
      FROM products p
      LEFT JOIN prices pr ON pr.product_id = p.id AND pr.price_type = 'supplier'
      LEFT JOIN LATERAL (
        SELECT SUM(wpl.available_quantity) AS available_quantity
        FROM warehouse_product_links wpl
        WHERE wpl.product_id = p.id
      ) w ON TRUE
      WHERE ${conditions.join(' AND ')}
      ORDER BY p.updated_at DESC
      LIMIT ${filters.limit || 50000}
    `;

    const res = await db.query(baseQuery, params);
    return res.rows;
  }

  static toCSV(rows) {
    if (!rows || rows.length === 0) return '';
    const headers = Object.keys(rows[0]);
    const escape = (v) => {
      if (v == null) return '';
      const s = String(v).replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    };
    const lines = [headers.join(',')];
    for (const row of rows) {
      lines.push(headers.map(h => escape(row[h])).join(','));
    }
    return lines.join('\n');
  }
}

module.exports = ExportJob;


