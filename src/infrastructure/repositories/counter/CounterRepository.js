const Counter = require('../../../database/models/counter/counterModel');

class CounterRepository {
  // $inc atômico com upsert: duas aberturas simultâneas nunca recebem o mesmo número.
  async next(key) {
    const doc = await Counter.findOneAndUpdate(
      { key },
      { $inc: { value: 1 } },
      { new: true, upsert: true },
    );
    return doc.value;
  }
}

module.exports = CounterRepository;
