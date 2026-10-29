const httpError = require('../../../lib/httpError');

// Ofício de encaminhamento para aquisição — o documento que sai do sistema
// rumo ao setor de compras.
class GeneratePurchaseLetterOperation {
  constructor({ assetRequestService, unitRepository, userRepository, pdfService }) {
    this.assetRequestService = assetRequestService;
    this.unitRepository = unitRepository;
    this.userRepository = userRepository;
    this.pdfService = pdfService;
  }

  async execute({ actor, request_id }) {
    const request = await this.assetRequestService.load(request_id, actor);
    if (request.status !== 'encaminhada_compra') throw httpError(409, 'O ofício só existe para pedidos encaminhados para compra');
    const unit = await this.unitRepository.findById(request.unit_id);
    const buffer = await this.pdfService.purchaseLetter({ request, unit });
    return { buffer, mime: 'application/pdf', fileName: `oficio-${request.number}.pdf` };
  }
}

module.exports = GeneratePurchaseLetterOperation;
