const logger = require('../../lib/logger');

// Mapa dentro dos PDFs: monta a área a partir dos quadradinhos (tiles) do
// OpenStreetMap, desenha alfinetes para cada ponto de GPS, o círculo da área da
// unidade e um link para abrir no Google Maps. Sem rede, o documento sai sem o
// fundo do mapa — os alfinetes e as coordenadas continuam.
//
// Uso leve do servidor público do OSM (com identificação e cache), como pede a
// política de uso dele. Em produção, trocar TILE_URL por um provedor contratado.
const TILE_URL = process.env.MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE = 256;
// Os tiles são desenhados pela metade (1 px = 0,5 pt): o dobro de nitidez no PDF.
const SCALE = 0.5;
const MAX_ZOOM = 18;
const CACHE_MAX = 400;

const C = { ink: '#1F2230', clay: '#8E3B22', ok: '#2E7D4F', out: '#C62828', pin: '#C4532D', muted: '#6B5E55' };

const worldPx = (lat, lng, z) => {
  const n = TILE * 2 ** z;
  const rad = (Math.max(-85, Math.min(85, lat)) * Math.PI) / 180;
  return { x: ((lng + 180) / 360) * n, y: ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n };
};

class MapService {
  constructor() {
    this.cache = new Map();
  }

  async tile(z, x, y) {
    const key = `${z}/${x}/${y}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const url = TILE_URL.replace('{z}', z).replace('{x}', x).replace('{y}', y);
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Erekoara/1.0 (inventario patrimonial TJPA - hackathon)', Accept: 'image/png' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`tile ${key}: HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (this.cache.size >= CACHE_MAX) this.cache.delete(this.cache.keys().next().value);
    this.cache.set(key, buf);
    return buf;
  }

  // Maior zoom em que todos os pontos cabem na caixa (com folga para os alfinetes).
  fitZoom(points, wPx, hPx) {
    if (points.length === 1) return 17;
    for (let z = MAX_ZOOM; z >= 3; z -= 1) {
      const px = points.map(p => worldPx(p.lat, p.lng, z));
      const dx = Math.max(...px.map(p => p.x)) - Math.min(...px.map(p => p.x));
      const dy = Math.max(...px.map(p => p.y)) - Math.min(...px.map(p => p.y));
      if (dx <= wPx - 80 && dy <= hPx - 90) return z;
    }
    return 3;
  }

  // points: [{ lat, lng, label, color }] · unit: { lat, lng } · radiusM: raio da unidade
  async draw(doc, { x, y, width, height, points, unit = null, radiusM = null }) {
    const all = [...points, ...(unit ? [unit] : [])];
    if (!all.length) return false;
    const wPx = width / SCALE;
    const hPx = height / SCALE;
    const z = Math.min(this.fitZoom(all, wPx, hPx), MAX_ZOOM);
    const px = all.map(p => worldPx(p.lat, p.lng, z));
    const cx = (Math.max(...px.map(p => p.x)) + Math.min(...px.map(p => p.x))) / 2;
    // Alfinete aponta para baixo: centraliza um pouco abaixo para caber a cabeça.
    const cy = (Math.max(...px.map(p => p.y)) + Math.min(...px.map(p => p.y))) / 2 - 12;
    const left = cx - wPx / 2;
    const top = cy - hPx / 2;
    const toPt = p => ({ x: x + (p.x - left) * SCALE, y: y + (p.y - top) * SCALE });

    const tiles = [];
    for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + wPx) / TILE); tx += 1) {
      for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + hPx) / TILE); ty += 1) tiles.push({ tx, ty });
    }
    const max = 2 ** z;
    const loaded = await Promise.all(tiles.map(t => this.tile(z, ((t.tx % max) + max) % max, t.ty)
      .then(buf => ({ ...t, buf }))
      .catch(err => { logger.warn('mapa: tile indisponível', { error: err.message }); return { ...t, buf: null }; })));

    doc.save();
    doc.rect(x, y, width, height).clip();
    doc.rect(x, y, width, height).fill('#E8E4DC');
    loaded.forEach(t => {
      if (!t.buf) return;
      try { doc.image(t.buf, x + (t.tx * TILE - left) * SCALE, y + (t.ty * TILE - top) * SCALE, { width: TILE * SCALE, height: TILE * SCALE }); } catch { /* tile ilegível */ }
    });
    const noTiles = loaded.every(t => !t.buf);
    if (noTiles) {
      doc.fillColor(C.muted).font('Helvetica').fontSize(8)
        .text('Fundo do mapa indisponível no momento (sem conexão com o serviço de mapas).', x + 10, y + 10, { width: width - 20 });
    }

    // Área da unidade: círculo com o raio que conta como "na unidade".
    if (unit) {
      const u = toPt(worldPx(unit.lat, unit.lng, z));
      if (radiusM) {
        const metersPerPx = (156543.03392 * Math.cos((unit.lat * Math.PI) / 180)) / 2 ** z;
        const r = (radiusM / metersPerPx) * SCALE;
        doc.circle(u.x, u.y, r).fillOpacity(0.12).fill(C.clay);
        doc.fillOpacity(1).circle(u.x, u.y, r).dash(3, { space: 2 }).strokeColor(C.clay).lineWidth(0.8).stroke().undash();
      }
      doc.fillOpacity(1).rect(u.x - 5, u.y - 5, 10, 10).fill(C.ink);
      doc.rect(u.x - 5, u.y - 5, 10, 10).strokeColor('#FFFFFF').lineWidth(1.2).stroke();
    }

    // Alfinetes no estilo do Google Maps, com o rótulo dentro da cabeça. Alfinetes
    // numerados no mesmo lugar (ex.: envio e recebimento na mesma sala) ficam lado a lado.
    const placed = [];
    points.forEach(p => {
      const pt = toPt(worldPx(p.lat, p.lng, z));
      if (p.label) {
        while (placed.some(q => Math.abs(q.x - pt.x) < 14 && Math.abs(q.y - pt.y) < 14)) pt.x += 17;
        placed.push({ ...pt });
      }
      const color = p.color || C.pin;
      doc.fillOpacity(1).circle(pt.x, pt.y - 15, 8).fill(color);
      doc.polygon([pt.x - 6, pt.y - 10], [pt.x + 6, pt.y - 10], [pt.x, pt.y]).fill(color);
      doc.circle(pt.x, pt.y - 15, 8).strokeColor('#FFFFFF').lineWidth(1).stroke();
      if (p.label) {
        doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(String(p.label).length > 2 ? 5.5 : 7)
          .text(String(p.label), pt.x - 8, pt.y - 18.5, { width: 16, align: 'center', lineBreak: false });
      }
    });
    doc.restore();

    // Moldura, atribuição (obrigatória) e link para o Google Maps.
    doc.rect(x, y, width, height).strokeColor('#BFB3A3').lineWidth(0.8).stroke();
    const attr = '© OpenStreetMap';
    doc.font('Helvetica').fontSize(6);
    const aw = doc.widthOfString(attr) + 6;
    doc.rect(x + width - aw, y + height - 9, aw, 9).fillOpacity(0.85).fill('#FFFFFF');
    doc.fillOpacity(1).fillColor(C.muted).text(attr, x + width - aw + 3, y + height - 7.5, { lineBreak: false });
    const center = points[0] || unit;
    const link = `https://www.google.com/maps/search/?api=1&query=${center.lat},${center.lng}`;
    doc.link(x, y, width, height, link);
    doc.fillColor('#1A56B0').font('Helvetica').fontSize(7.5)
      .text('Abrir no Google Maps', x, y + height + 3, { width, align: 'left', link, underline: true, lineBreak: false });
    doc.fillColor(C.ink);
    doc.y = y + height + 14;
    return true;
  }
}

MapService.COLORS = C;

module.exports = MapService;
