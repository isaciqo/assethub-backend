const validateContract = (validation, stripUnknown = true) => (req, res, next) => {
  if (!validation) return next();

  try {
    const schemaOptions = { abortEarly: false, convert: true, allowUnknown: false, stripUnknown };

    for (const key of Object.keys(validation)) {
      const { error, value } = validation[key].validate(req[key], schemaOptions);
      if (error) throw error;
      req[key] = value;
    }

    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = validateContract;
