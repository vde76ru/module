// backend/src/services/SmartMappingService.js
// Интеллектуальный маппинг: fuzzy matching, Левенштейн, SoundexRU, скоринг уверенности

const db = require('../config/database');

class SmartMappingService {
  // Левенштейн расстояние
  static levenshtein(a, b) {
    if (a === b) return 0;
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const v0 = new Array(b.length + 1).fill(0);
    const v1 = new Array(b.length + 1).fill(0);
    for (let i = 0; i <= b.length; i++) v0[i] = i;
    for (let i = 0; i < a.length; i++) {
      v1[0] = i + 1;
      for (let j = 0; j < b.length; j++) {
        const cost = a[i] === b[j] ? 0 : 1;
        v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
      }
      for (let j = 0; j <= b.length; j++) v0[j] = v1[j];
    }
    return v1[b.length];
  }

  // Простейший Soundex для русских слов (упрощенная реализация)
  static soundexRu(s) {
    if (!s) return '';
    const str = String(s).toLowerCase().replace(/[^а-яa-z0-9]/g, '');
    if (!str) return '';
    const map = new Map([
      // Согласные сгруппированы по звучанию
      ['бп', '1'], ['вф', '2'], ['гкх', '3'], ['дт', '4'], ['жшщч', '5'], ['зсц', '6'], ['л', '7'], ['мн', '8'], ['р', '9']
    ]);
    const code = [str[0]];
    for (let i = 1; i < str.length; i++) {
      let digit = '';
      for (const [letters, d] of map.entries()) {
        if (letters.includes(str[i])) { digit = d; break; }
      }
      if (digit && digit !== code[code.length - 1]) code.push(digit);
    }
    return code.join('').padEnd(4, '0').slice(0, 4);
  }

  // Универсальный скоринг сходства [0..1]
  static similarityScore(a, b) {
    if (!a || !b) return 0;
    const s1 = String(a).trim().toLowerCase();
    const s2 = String(b).trim().toLowerCase();
    if (!s1 || !s2) return 0;
    const maxLen = Math.max(s1.length, s2.length);
    const lev = this.levenshtein(s1, s2);
    const levScore = 1 - lev / maxLen; // 0..1
    const sx1 = this.soundexRu(s1);
    const sx2 = this.soundexRu(s2);
    const soundexScore = sx1 === sx2 ? 1 : 0;
    // взвешивание: 0.8 левенштейн + 0.2 саундекс
    return Math.max(0, Math.min(1, 0.8 * levScore + 0.2 * soundexScore));
  }

  // Подбор похожей категории среди categories
  static async suggestCategory(companyId, externalName, limit = 5) {
    const res = await db.query(
      'SELECT id, name FROM categories WHERE company_id = $1 AND is_active = true',
      [companyId]
    );
    const candidates = res.rows.map(r => ({ id: r.id, name: r.name, score: this.similarityScore(externalName, r.name) }));
    return candidates.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  // Подбор похожего атрибута среди product_attributes
  static async suggestAttribute(companyId, externalKeyOrName, limit = 5) {
    const res = await db.query(
      'SELECT id, name, display_name FROM product_attributes WHERE company_id = $1 AND is_active = true',
      [companyId]
    );
    const candidates = res.rows.map(r => {
      const base = r.display_name || r.name;
      return { id: r.id, name: r.name, display_name: r.display_name, score: this.similarityScore(externalKeyOrName, base) };
    });
    return candidates.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  // Подбор похожего бренда среди brands
  static async suggestBrand(companyId, externalBrandName, limit = 5) {
    const res = await db.query(
      'SELECT id, name FROM brands WHERE company_id = $1 AND is_active = true',
      [companyId]
    );
    const candidates = res.rows.map(r => ({ id: r.id, name: r.name, score: this.similarityScore(externalBrandName, r.name) }));
    return candidates.sort((a, b) => b.score - a.score).slice(0, limit);
  }
}

module.exports = SmartMappingService;


