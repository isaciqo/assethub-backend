const Joi = require('joi');

module.exports = () => ({
  login: Joi.object({
    email: Joi.string().email({ tlds: { allow: false } }).required(),
    password: Joi.string().min(1).required(),
  }),
  refresh: Joi.object({
    refreshToken: Joi.string().required(),
  }),
});
