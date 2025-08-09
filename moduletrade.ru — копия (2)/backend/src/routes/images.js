const express = require('express');
const router = express.Router();
const axios = require('axios');
const sharp = require('sharp');
const cryptoUtils = require('../utils/crypto');
const cache = require('../config/redis');

// Прокси изображений с шифрованием источника и кэшированием
router.get('/proxy/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const decoded = cryptoUtils.decrypt(decodeURIComponent(token));
    const payload = typeof decoded === 'string' ? JSON.parse(decoded) : decoded;
    const sourceUrl = payload.u;

    if (!/^https?:\/\//i.test(sourceUrl)) {
      return res.status(400).json({ success: false, error: 'Invalid image url' });
    }

    const cacheKey = `img:${Buffer.from(sourceUrl).toString('base64')}`;
    const cached = await cache.get(cacheKey);
    if (cached && cached.data && cached.contentType) {
      res.set('Content-Type', cached.contentType);
      return res.send(Buffer.from(cached.data, 'base64'));
    }

    const response = await axios.get(sourceUrl, { responseType: 'arraybuffer', timeout: 15000 });

    const acceptWebp = /image\/webp/.test(req.headers.accept || '');
    const inboundType = response.headers['content-type'] || 'image/jpeg';
    let outBuffer = Buffer.from(response.data);
    let outType = inboundType;

    if (acceptWebp) {
      try {
        outBuffer = await sharp(outBuffer).webp({ quality: 82 }).toBuffer();
        outType = 'image/webp';
      } catch (_) {}
    }

    // cache for 6h
    try {
      await cache.set(cacheKey, { data: outBuffer.toString('base64'), contentType: outType }, 21600);
    } catch (_) {}

    res.set('Content-Type', outType);
    return res.send(outBuffer);
  } catch (error) {
    return res.status(404).end();
  }
});

module.exports = router;

