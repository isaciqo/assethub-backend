// Resposta binária (PDF, XLSX, CSV, imagem). `inline` abre no navegador em vez
// de forçar download — usado nas fotos e no termo em PDF.
function sendFile(res, { buffer, mime, fileName }, { inline = false } = {}) {
  res.setHeader('Content-Type', mime);
  res.setHeader('Content-Length', buffer.length);
  res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(fileName)}"`);
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
  res.status(200).end(buffer);
}

module.exports = sendFile;
