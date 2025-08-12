// backend/src/services/MediaService.js
// Работа с изображениями и документами: загрузка по URL, оптимизация, ресайз

const axios = require('axios');
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

class MediaService {
  async downloadImageToWebp(url, subdir = 'products', quality = 82) {
    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 45000, headers: { 'User-Agent': 'ModuleTrade/1.0' } });
    const buf = Buffer.from(res.data);
    const outDir = path.join(process.cwd(), 'uploads', subdir);
    await fs.mkdir(outDir, { recursive: true });
    const base = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const outPath = path.join(outDir, base + '.webp');
    const webp = await sharp(buf).webp({ quality }).toBuffer();
    await fs.writeFile(outPath, webp);
    return {
      file_url: `/uploads/${subdir}/${path.basename(outPath)}`,
      file_size: webp.length,
      mime_type: 'image/webp'
    };
  }

  async downloadFile(url, subdir = 'documents') {
    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 60000, headers: { 'User-Agent': 'ModuleTrade/1.0' } });
    const buf = Buffer.from(res.data);
    const outDir = path.join(process.cwd(), 'uploads', subdir);
    await fs.mkdir(outDir, { recursive: true });
    const ext = this.inferExt(res.headers['content-type']) || path.extname(new URL(url).pathname) || '.bin';
    const base = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const outPath = path.join(outDir, base + ext);
    await fs.writeFile(outPath, buf);
    return {
      file_url: `/uploads/${subdir}/${path.basename(outPath)}`,
      file_size: buf.length,
      mime_type: res.headers['content-type'] || 'application/octet-stream'
    };
  }

  inferExt(mime) {
    const map = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'application/pdf': '.pdf',
      'text/plain': '.txt'
    };
    return map[mime] || null;
  }
}

module.exports = new MediaService();


