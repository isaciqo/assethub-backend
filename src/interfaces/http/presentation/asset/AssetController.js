const sendFile = require('../shared/sendFile');

class AssetController {
  constructor({
    listAssetsOperation, getAssetOperation, getAssetFacetsOperation, createAssetOperation,
    updateAssetOperation, importAssetsOperation, exportAssetsOperation,
  }) {
    this.listAssetsOperation = listAssetsOperation;
    this.getAssetOperation = getAssetOperation;
    this.getAssetFacetsOperation = getAssetFacetsOperation;
    this.createAssetOperation = createAssetOperation;
    this.updateAssetOperation = updateAssetOperation;
    this.importAssetsOperation = importAssetsOperation;
    this.exportAssetsOperation = exportAssetsOperation;
  }

  async list(req, res) {
    res.status(200).json(await this.listAssetsOperation.execute(req.query));
  }

  async facets(req, res) {
    res.status(200).json(await this.getAssetFacetsOperation.execute(req.query));
  }

  async detail(req, res) {
    res.status(200).json(await this.getAssetOperation.execute({ asset_id: req.params.asset_id }));
  }

  async lookup(req, res) {
    res.status(200).json(await this.getAssetOperation.execute({ code: req.params.code }));
  }

  async create(req, res) {
    res.status(201).json(await this.createAssetOperation.execute({ actor: req.user, data: req.body }));
  }

  async update(req, res) {
    res.status(200).json(await this.updateAssetOperation.execute({ actor: req.user, asset_id: req.params.asset_id, data: req.body }));
  }

  async importFile(req, res) {
    const result = await this.importAssetsOperation.execute({
      actor: req.user,
      buffer: req.file?.buffer,
      fileName: req.file?.originalname || 'planilha',
      mapping: req.body.mapping,
      default_unit_id: req.body.default_unit_id || null,
      dryRun: req.body.dry_run === true || req.body.dry_run === 'true',
    });
    res.status(200).json(result);
  }

  async exportFile(req, res) {
    sendFile(res, await this.exportAssetsOperation.execute(req.query));
  }
}

module.exports = AssetController;
