const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticate, checkPermission } = require('../middleware/auth');
const DocumentService = require('../services/DocumentService');

const service = new DocumentService();

// Ограничения и хранилище для загрузки файлов документов
const uploadsDir = path.join(process.cwd(), 'uploads', 'documents');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'doc-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
});

// Получение документов товара
router.get('/products/:productId/documents', authenticate, async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const docs = await service.getProductDocuments(req.params.productId, companyId);
    res.json({ success: true, data: docs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Создание документа (запись без файла)
router.post('/products/:productId/documents', authenticate, checkPermission('products.update'), async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const created = await service.createDocument(companyId, { ...req.body, product_id: req.params.productId }, req.user.userId);
    res.json({ success: true, data: created });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Загрузка файла документа
router.post('/products/:productId/documents/upload', authenticate, checkPermission('products.update'), upload.single('file'), async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const file = req.file;
    const payload = req.body || {};
    const fileUrl = `/uploads/documents/${path.basename(file.path)}`;
    const created = await service.createDocument(companyId, {
      product_id: req.params.productId,
      document_type: payload.document_type || 'other',
      name: payload.name || file.originalname,
      file_url: fileUrl,
      supplier_id: payload.supplier_id || null,
      file_size: file.size,
      mime_type: file.mimetype,
      metadata: payload.metadata ? JSON.parse(payload.metadata) : undefined
    }, req.user.userId);
    res.json({ success: true, data: created });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Обновление документа
router.put('/documents/:id', authenticate, checkPermission('products.update'), async (req, res) => {
  try {
    const updated = await service.updateDocument(req.params.id, req.body, req.user.userId, req.user.companyId);
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Удаление документа
router.delete('/documents/:id', authenticate, checkPermission('products.update'), async (req, res) => {
  try {
    const result = await service.deleteDocument(req.params.id, req.user.companyId);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;

