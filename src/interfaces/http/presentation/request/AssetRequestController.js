const sendFile = require('../shared/sendFile');
const { REQUEST_CATALOG } = require('../../../../lib/constants');

class AssetRequestController {
  constructor({
    createAssetRequestOperation, listAssetRequestsOperation, getAssetRequestOperation, suggestAvailableAssetsOperation,
    fulfillAssetRequestOperation, forwardAssetRequestToPurchaseOperation, rejectAssetRequestOperation,
    cancelAssetRequestOperation, generatePurchaseLetterOperation,
  }) {
    this.createAssetRequestOperation = createAssetRequestOperation;
    this.listAssetRequestsOperation = listAssetRequestsOperation;
    this.getAssetRequestOperation = getAssetRequestOperation;
    this.suggestAvailableAssetsOperation = suggestAvailableAssetsOperation;
    this.fulfillAssetRequestOperation = fulfillAssetRequestOperation;
    this.forwardAssetRequestToPurchaseOperation = forwardAssetRequestToPurchaseOperation;
    this.rejectAssetRequestOperation = rejectAssetRequestOperation;
    this.cancelAssetRequestOperation = cancelAssetRequestOperation;
    this.generatePurchaseLetterOperation = generatePurchaseLetterOperation;
  }

  async catalog(req, res) {
    res.status(200).json(REQUEST_CATALOG);
  }

  async create(req, res) {
    res.status(201).json(await this.createAssetRequestOperation.execute({ actor: req.user, data: req.body }));
  }

  async list(req, res) {
    res.status(200).json(await this.listAssetRequestsOperation.execute({ actor: req.user, ...req.query }));
  }

  async detail(req, res) {
    res.status(200).json(await this.getAssetRequestOperation.execute({ actor: req.user, request_id: req.params.request_id }));
  }

  async suggestions(req, res) {
    res.status(200).json(await this.suggestAvailableAssetsOperation.execute({ actor: req.user, request_id: req.params.request_id }));
  }

  async fulfill(req, res) {
    res.status(200).json(await this.fulfillAssetRequestOperation.execute({ actor: req.user, request_id: req.params.request_id, ...req.body }));
  }

  async purchase(req, res) {
    res.status(200).json(await this.forwardAssetRequestToPurchaseOperation.execute({ actor: req.user, request_id: req.params.request_id, ...req.body }));
  }

  async reject(req, res) {
    res.status(200).json(await this.rejectAssetRequestOperation.execute({ actor: req.user, request_id: req.params.request_id, reason: req.body.reason }));
  }

  async cancel(req, res) {
    res.status(200).json(await this.cancelAssetRequestOperation.execute({ actor: req.user, request_id: req.params.request_id }));
  }

  async letter(req, res) {
    sendFile(res, await this.generatePurchaseLetterOperation.execute({ actor: req.user, request_id: req.params.request_id }));
  }
}

module.exports = AssetRequestController;
