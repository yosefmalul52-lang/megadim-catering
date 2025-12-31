// Wrapper for async route handlers to catch errors
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Helper to create validation errors
const createValidationError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  error.isValidationError = true;
  return error;
};

// Helper to create not found errors
const createNotFoundError = (message) => {
  const error = new Error(message);
  error.statusCode = 404;
  error.isNotFoundError = true;
  return error;
};

module.exports = {
  asyncHandler,
  createValidationError,
  createNotFoundError
};

