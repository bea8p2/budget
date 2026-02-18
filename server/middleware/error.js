// server/middleware/error.js
import { AppError } from '../utils/errors.js';

// 404 handler for any route that wasn't matched above
export function notFoundHandler(req, res, next) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
}

// Central error handler to normalize all error responses
export function errorHandler(err, req, res, _next) {
  // Default shape
  let status = err.status || 500;
  let message = err.message || 'Unexpected error';

  // Mongo duplicate key error (e.g., unique index on account name)
  if (err?.code === 11000) {
    status = 400;
    const fields = Object.keys(err.keyPattern || {});
    message = fields.length
      ? `Duplicate value for field(s): ${fields.join(', ')}.`
      : 'Duplicate value.';
  }

  // Invalid ObjectId cast (e.g., malformed :id)
  if (err.name === 'CastError') {
    status = 400;
    message = `Invalid value for "${err.path}".`;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    status = 400;
    message = 'Validation failed.';
  }

  // JSON parse error from body-parser
  if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Invalid JSON body.';
  }

  const body = { error: message };
  if (err.details) body.details = err.details;

  res.status(status).json(body);
}