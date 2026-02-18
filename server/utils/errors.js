// server/utils/errors.js

// Small error class with status codes
export class AppError extends Error {
  constructor(message, status = 500, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    if (details) this.details = details;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

// Helper to throw 400/404 with one line
export const badRequest = (msg, details) => new AppError(msg, 400, details);
export const notFound   = (msg, details) => new AppError(msg, 404, details);

// Wrap async route handlers to forward errors to the error middleware
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);