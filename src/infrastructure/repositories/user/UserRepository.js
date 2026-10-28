const User = require('../../../database/models/user/userModel');

class UserRepository {
  async findById(user_id) {
    return User.findOne({ user_id });
  }

  async findByEmail(email) {
    return User.findOne({ email: String(email).toLowerCase().trim() });
  }

  async findByIds(ids) {
    if (!ids.length) return [];
    return User.find({ user_id: { $in: ids } });
  }

  async findAll(filter = {}) {
    return User.find({ active: true, ...filter }).sort({ name: 1 }).limit(1000);
  }

  async create(data) {
    return new User(data).save();
  }

  async update(user_id, data) {
    return User.findOneAndUpdate({ user_id }, data, { new: true });
  }

  async count() {
    return User.countDocuments();
  }
}

module.exports = UserRepository;
