const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const httpError = require('../../lib/httpError');

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_BYTES = 5 * 1024 * 1024;

// Evidências chegam como data URL dentro do JSON — inclusive as capturadas
// offline, que ficam no IndexedDB até a sincronização. Um único formato para
// foto, assinatura desenhada e documento anexo.
class EvidenceService {
  constructor({ evidenceRepository }) {
    this.evidenceRepository = evidenceRepository;
  }

  decodeDataUrl(dataUrl) {
    const match = /^data:([a-z0-9.+/-]+);base64,(.+)$/i.exec(String(dataUrl || ''));
    if (!match) throw httpError(400, 'Arquivo de evidência em formato inválido');
    const mime = match[1].toLowerCase();
    if (!ALLOWED_MIME.includes(mime)) throw httpError(400, `Tipo de arquivo não permitido: ${mime}`);
    const data = Buffer.from(match[2], 'base64');
    if (!data.length) throw httpError(400, 'Arquivo de evidência vazio');
    if (data.length > MAX_BYTES) throw httpError(413, 'Arquivo de evidência maior que 5 MB');
    return { mime, data };
  }

  async store({ dataUrl, owner_type, owner_id, stage = '', kind, actor, description = '', file_name = '' }) {
    const { mime, data } = this.decodeDataUrl(dataUrl);
    const evidence = await this.evidenceRepository.create({
      evidence_id: uuidv4(),
      owner_type,
      owner_id,
      stage,
      kind,
      mime,
      file_name,
      size: data.length,
      // Hash do arquivo vai para o histórico encadeado e para o termo em PDF:
      // trocar a imagem depois fica detectável.
      sha256: crypto.createHash('sha256').update(data).digest('hex'),
      data,
      description,
      created_by: actor.user_id,
      created_by_name: actor.name || '',
    });
    return evidence;
  }
}

module.exports = EvidenceService;
