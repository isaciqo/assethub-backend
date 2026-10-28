const mongoose = require('mongoose');
const { MOVEMENT_STATUS, CONSERVATION_STATUS } = require('../../../lib/constants');

const placeSchema = new mongoose.Schema({
  unit_id: { type: String, required: true },
  location: { type: String, default: '' },
  responsible_name: { type: String, default: '' },
}, { _id: false });

const approvalSchema = new mongoose.Schema({
  user_id: { type: String, required: true },
  status: { type: String, enum: ['pendente', 'aprovada', 'rejeitada'], default: 'pendente' },
  note: { type: String, default: '' },
  decided_at: { type: Date, default: null },
  decided_by: { type: String, default: null },
}, { _id: false });

const geoSchema = new mongoose.Schema({
  lat: Number,
  lng: Number,
  accuracy: { type: Number, default: null },
  distance_m: { type: Number, default: null },
  outside_unit: { type: Boolean, default: false },
}, { _id: false });

const handoverSchema = new mongoose.Schema({
  at: { type: Date, default: null },
  by: { type: String, default: null },
  by_name: { type: String, default: '' },
  // Condição de cada bem no momento do envio/recebimento.
  conditions: [{ _id: false, asset_id: String, condition: { type: String, enum: CONSERVATION_STATUS } }],
  notes: { type: String, default: '' },
  signature_evidence_id: { type: String, default: null },
  signer_name: { type: String, default: '' },
  photo_evidence_ids: { type: [String], default: [] },
  has_issue: { type: Boolean, default: false },
  issue_description: { type: String, default: '' },
  geo: { type: geoSchema, default: null },
}, { _id: false });

const movementSchema = new mongoose.Schema({
  movement_id: { type: String, required: true, unique: true },
  number: { type: String, required: true, unique: true },
  type: { type: String, required: true },
  reason: { type: String, required: true },
  asset_ids: { type: [String], required: true },
  origin: { type: placeSchema, required: true },
  destination: { type: placeSchema, required: true },
  requested_by: { type: String, required: true },
  approvals: { type: [approvalSchema], default: [] },
  deliverer_id: { type: String, required: true },
  receiver_id: { type: String, required: true },
  carrier: {
    company: { type: String, default: '' },
    driver_name: { type: String, default: '' },
    driver_document: { type: String, default: '' },
    vehicle_plate: { type: String, default: '' },
  },
  expected_date: { type: Date, default: null },
  delivery: { type: handoverSchema, default: () => ({}) },
  receipt: { type: handoverSchema, default: () => ({}) },
  issue_resolution: {
    note: { type: String, default: '' },
    resolved_by: { type: String, default: null },
    resolved_at: { type: Date, default: null },
  },
  status: { type: String, enum: MOVEMENT_STATUS, default: 'aguardando_aprovacao' },
  // Ponta da cadeia de hashes dos eventos — vai impressa no termo em PDF.
  chain_head: { type: String, default: null },
  source_discrepancy_id: { type: String, default: null },
  completed_at: { type: Date, default: null },
}, { timestamps: true });

movementSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Movement', movementSchema);
