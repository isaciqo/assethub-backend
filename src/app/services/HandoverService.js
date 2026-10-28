const httpError = require('../../lib/httpError');

// Monta o registro de entrega/recebimento: grava assinatura e fotos como
// evidências e devolve o bloco pronto para salvar na movimentação.
class HandoverService {
  constructor({ evidenceService }) {
    this.evidenceService = evidenceService;
  }

  async build({ actor, movement, stage, input }) {
    const ids = new Set(movement.asset_ids);
    const conditions = (input.conditions || []).filter(c => ids.has(c.asset_id));
    if (conditions.length !== ids.size) throw httpError(400, 'Informe o estado de conservação de todos os bens');
    if (!input.signature) throw httpError(400, 'A assinatura é obrigatória para confirmar esta etapa');

    const signature = await this.evidenceService.store({
      dataUrl: input.signature,
      owner_type: 'movement',
      owner_id: movement.movement_id,
      stage,
      kind: 'assinatura',
      actor,
      description: `Assinatura de ${input.signer_name || actor.name} na ${stage}`,
    });

    const photos = [];
    for (const [i, dataUrl] of (input.photos || []).entries()) {
      photos.push(await this.evidenceService.store({
        dataUrl,
        owner_type: 'movement',
        owner_id: movement.movement_id,
        stage,
        kind: dataUrl.startsWith('data:application/pdf') ? 'documento' : 'foto',
        actor,
        description: `${stage === 'entrega' ? 'Entrega' : 'Recebimento'} — anexo ${i + 1}`,
      }));
    }

    return {
      handover: {
        at: new Date(),
        by: actor.user_id,
        by_name: actor.name || '',
        conditions: conditions.map(c => ({ asset_id: c.asset_id, condition: c.condition })),
        notes: input.notes || '',
        signature_evidence_id: signature.evidence_id,
        signer_name: input.signer_name || actor.name || '',
        photo_evidence_ids: photos.map(p => p.evidence_id),
        has_issue: !!input.has_issue,
        issue_description: input.issue_description || '',
      },
      evidenceHashes: { signature: signature.sha256, photos: photos.map(p => p.sha256) },
    };
  }
}

module.exports = HandoverService;
