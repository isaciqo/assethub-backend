// Última foto feita do bem, venha de onde vier: conferência, envio/recebimento
// de uma movimentação ou anexo do próprio bem (ex.: foto na baixa). Usada na
// ficha do bem e no relatório em PDF.
class AssetPhotoService {
  constructor({ evidenceRepository }) {
    this.evidenceRepository = evidenceRepository;
  }

  // checks e movements já carregados pelo chamador (documentos do Mongo).
  async latest(asset_id, { checks = [], movements = [] } = {}) {
    const candidates = [];
    checks.forEach(c => {
      if (c.photo_evidence_id) candidates.push({ evidence_id: c.photo_evidence_id, at: c.checked_at, by: c.checked_by_name || '', source: 'Foto da conferência' });
    });
    movements.forEach(m => {
      [['delivery', 'Foto do envio'], ['receipt', 'Foto do recebimento']].forEach(([k, source]) => {
        const h = m[k];
        (h?.photo_evidence_ids || []).forEach(id => candidates.push({ evidence_id: id, at: h.at, by: h.by_name || '', source: `${source} (${m.number})` }));
      });
    });
    const own = await this.evidenceRepository.findMetaByOwner('asset', asset_id);
    own.filter(e => e.kind === 'foto').forEach(e => candidates.push({
      evidence_id: e.evidence_id, at: e.createdAt, by: e.created_by_name || '', source: e.stage === 'baixa' ? 'Foto anexada na baixa' : 'Foto anexada ao bem',
    }));

    // Só imagens que o PDF consegue desenhar (o app comprime as fotos em JPEG).
    const metas = await this.evidenceRepository.findMetaByIds(candidates.map(c => c.evidence_id));
    const drawable = new Set(metas.filter(e => /^image\/(jpe?g|png)$/.test(e.mime)).map(e => e.evidence_id));
    const best = candidates
      .filter(c => drawable.has(c.evidence_id))
      .sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0))[0];
    return best || null;
  }
}

module.exports = AssetPhotoService;
