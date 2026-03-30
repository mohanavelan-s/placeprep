const { validationResult } = require('express-validator');
const AppError = require('../utils/appError');

function validate(req, res, next) {
  const validation = validationResult(req);

  if (validation.isEmpty()) {
    next();
    return;
  }

  next(new AppError('Validation failed.', 400, validation.array()));
}

module.exports = validate;
