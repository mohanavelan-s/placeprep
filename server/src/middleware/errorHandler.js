const multer = require('multer');

function errorHandler(error, req, res, next) {
  const statusCode = error.statusCode || error.status || 500;

  if (error instanceof multer.MulterError) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
    return;
  }

  if (error.code === '23505') {
    res.status(409).json({
      success: false,
      message: 'A record with the same unique value already exists.',
      detail: error.detail,
    });
    return;
  }

  if (error.code === '22P02') {
    res.status(400).json({
      success: false,
      message: 'Invalid identifier or malformed request value.',
    });
    return;
  }

  if (error.code === '23503') {
    res.status(400).json({
      success: false,
      message: 'Referenced record does not exist.',
      detail: error.detail,
    });
    return;
  }

  if (statusCode >= 500) {
    console.error(error);
  }

  res.status(statusCode).json({
    success: false,
    message: error.message || 'Internal server error.',
    ...(error.details ? { details: error.details } : {}),
  });
}

module.exports = errorHandler;
