const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const db = require('../config/database');
const supplierFactory = require('../adapters/SupplierFactory');
const cryptoUtils = require('../utils/crypto');

async function getRSAdapter(supplierId) {
  const res = await db.query('SELECT api_type, api_config FROM suppliers WHERE id = $1', [supplierId]);
  if (res.rows.length === 0) throw new Error('Supplier not found');
  let apiConfig = res.rows[0].api_config;
  if (typeof apiConfig === 'string' && cryptoUtils.isEncrypted(apiConfig)) apiConfig = cryptoUtils.decrypt(apiConfig);
  const adapter = supplierFactory.createAdapter('rs24', apiConfig || {});
  return adapter;
}

router.get('/:supplierId/warehouses', authenticate, async (req, res) => {
  try {
    const adapter = await getRSAdapter(req.params.supplierId);
    const warehouses = await adapter.getWarehouses();
    res.json({ success: true, data: warehouses });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:supplierId/position/:warehouseId/:category', authenticate, async (req, res) => {
  try {
    const { page, rows } = req.query;
    const adapter = await getRSAdapter(req.params.supplierId);
    const products = await adapter.getProducts({ warehouseId: req.params.warehouseId, category: req.params.category, page: Number(page) || 1, rows: Number(rows) || 1000 });
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:supplierId/finditem', authenticate, async (req, res) => {
  try {
    const { vendorCode } = req.body;
    const adapter = await getRSAdapter(req.params.supplierId);
    const products = await adapter.searchProducts(vendorCode);
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:supplierId/massprice', authenticate, async (req, res) => {
  try {
    const { items } = req.body;
    const adapter = await getRSAdapter(req.params.supplierId);
    const prices = await adapter.getPrices(items || []);
    res.json({ success: true, data: prices });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:supplierId/residue/:warehouseId/:code', authenticate, async (req, res) => {
  try {
    const adapter = await getRSAdapter(req.params.supplierId);
    const stocks = await adapter.getStockLevels([req.params.code], req.params.warehouseId);
    res.json({ success: true, data: stocks[0] || null });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:supplierId/residue/all/:warehouseId', authenticate, async (req, res) => {
  try {
    const { page, rows, category, partnerstock } = req.query;
    const adapter = await getRSAdapter(req.params.supplierId);
    const list = await adapter.getAllStocks(req.params.warehouseId, { page: Number(page) || 1, rows: Number(rows) || 200, category: category || 'skl', partnerstock: partnerstock || 'N' });
    res.json({ success: true, data: list });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:supplierId/partnerwhstock/all/:warehouseId', authenticate, async (req, res) => {
  try {
    const { page, rows, availability } = req.query;
    const adapter = await getRSAdapter(req.params.supplierId);
    const result = await adapter.getAllPartnerWarehouseStock(req.params.warehouseId, { page: Number(page) || 1, rows: Number(rows) || 500, availability: availability || 'instock' });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:supplierId/specs/:code', authenticate, async (req, res) => {
  try {
    const adapter = await getRSAdapter(req.params.supplierId);
    const product = await adapter.getProductDetails(req.params.code);
    res.json({ success: true, data: product });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;

