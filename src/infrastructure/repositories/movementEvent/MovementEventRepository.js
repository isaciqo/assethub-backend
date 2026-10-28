const MovementEvent = require('../../../database/models/movementEvent/movementEventModel');

class MovementEventRepository {
  async create(data) {
    return new MovementEvent(data).save();
  }

  async findByMovement(movement_id) {
    return MovementEvent.find({ movement_id }).sort({ seq: 1 });
  }

  async findLast(movement_id) {
    return MovementEvent.findOne({ movement_id }).sort({ seq: -1 });
  }
}

module.exports = MovementEventRepository;
