const multer = require('multer');

// Planilha fica só em memória: é lida, validada e descartada — nunca gravada em disco.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
});

// Multipart chega com os campos como texto; `mapping` vem serializado em JSON.
const parseMultipartJson = fields => (req, res, next) => {
  try {
    fields.forEach(f => {
      if (typeof req.body[f] === 'string' && req.body[f]) req.body[f] = JSON.parse(req.body[f]);
    });
    next();
  } catch {
    res.status(400).json({ error: 'Validation Error', details: [`Campo ${fields.join('/')} com JSON inválido`] });
  }
};

module.exports = { singleFile: upload.single('file'), parseMultipartJson };
