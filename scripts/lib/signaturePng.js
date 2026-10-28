const zlib = require('zlib');

// Gera um PNG de "assinatura" sintética (rabisco) sem depender de canvas nativo —
// só para os dados de demonstração do seed terem termo em PDF com assinatura.
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function signaturePng(seed = 1, width = 360, height = 110) {
  const px = Buffer.alloc(width * height * 4, 0);
  const plot = (x, y) => {
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        const xx = Math.round(x + dx);
        const yy = Math.round(y + dy);
        if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
        const i = (yy * width + xx) * 4;
        px[i] = 31; px[i + 1] = 34; px[i + 2] = 48; px[i + 3] = 255;
      }
    }
  };
  for (let t = 0; t < 1; t += 0.0004) {
    const x = 20 + t * (width - 40);
    const y = height / 2
      + Math.sin(t * (9 + seed) * Math.PI) * 22 * Math.sin(t * Math.PI)
      + Math.cos(t * (23 + seed * 2) * Math.PI) * 8;
    plot(x, y);
  }
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0;
    px.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  return `data:image/png;base64,${png.toString('base64')}`;
}

module.exports = signaturePng;
