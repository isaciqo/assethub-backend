const { v4: uuidv4 } = require('uuid');
const httpError = require('../../../lib/httpError');
const { normalizeCode } = require('../../../lib/text');
const { formatAsset } = require('../../../lib/formatters');

class CreateAssetOperation {
  constructor({ assetRepository, unitRepository, assetEventService }) {
    this.assetRepository = assetRepository;
    this.unitRepository = unitRepository;
    this.assetEventService = assetEventService;
  }

  async execute({ actor, data, reference_type = 'manual', reference_id = null }) {
    const code_normalized = normalizeCode(data.code);
    if (await this.assetRepository.findByCode(data.code)) throw httpError(409, `Já existe um bem com o tombamento ${data.code}`);
    if (!await this.unitRepository.findById(data.unit_id)) throw httpError(404, 'Unidade não encontrada');

    const asset = await this.assetRepository.create({
      asset_id: uuidv4(),
      code: data.code,
      code_normalized,
      description: data.description,
      category: data.category || 'Outros',
      brand: data.brand || '',
      serial_number: data.serial_number || '',
      unit_id: data.unit_id,
      location: data.location || '',
      responsible_name: data.responsible_name || '',
      conservation_status: data.conservation_status || 'bom',
      acquisition_date: data.acquisition_date || null,
      value: data.value ?? null,
      notes: data.notes || '',
    });
    if (asset.location) await this.unitRepository.addLocations(asset.unit_id, [asset.location]);

    await this.assetEventService.record({
      asset_id: asset.asset_id,
      event_type: 'cadastrado',
      summary: reference_type === 'discrepancy' ? 'Cadastrado a partir de um bem não previsto encontrado no inventário' : 'Cadastrado manualmente',
      actor,
      reference_type,
      reference_id,
    });
    return formatAsset(asset);
  }
}

module.exports = CreateAssetOperation;
