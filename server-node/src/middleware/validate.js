const { validationResult } = require('express-validator');
const AppError = require('../utils/appError');

function validate(req, res, next) {
  const validation = validationResult(req);

  if (validation.isEmpty()) {
    next();
    return;
  }

  const details = validation.array();
  const primaryIssue = details[0];
  const field = primaryIssue?.path || primaryIssue?.param || 'field';
  const issueMessage = primaryIssue?.msg && primaryIssue.msg !== 'Invalid value'
    ? primaryIssue.msg
    : `${field} is invalid.`;

  next(new AppError(issueMessage, 400, details));
}

module.exports = validate;
