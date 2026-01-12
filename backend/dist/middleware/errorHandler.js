"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createForbiddenError = exports.createUnauthorizedError = exports.createNotFoundError = exports.createValidationError = exports.createError = exports.asyncHandler = exports.errorHandler = exports.AppError = void 0;
class AppError extends Error {
    constructor(message, statusCode = 500) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
// Explicit error handler function with proper Express signature
const errorHandler = (error, req, res, next) => {
    // Type guard to check if error has statusCode
    const apiError = error;
    let { statusCode = 500, message } = apiError;
    // Log error details
    console.error(`❌ Error ${statusCode}: ${message}`);
    console.error('Stack trace:', error.stack);
    console.error('Request details:', {
        method: req.method,
        url: req.url,
        body: req.body,
        query: req.query,
        params: req.params,
        ip: req.ip,
        userAgent: req.get('User-Agent')
    });
    // Handle specific error types
    if (error.name === 'ValidationError') {
        statusCode = 400;
        message = 'Invalid input data';
    }
    else if (error.name === 'CastError') {
        statusCode = 400;
        message = 'Invalid data format';
    }
    else if (error.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = 'Invalid token';
    }
    else if (error.name === 'TokenExpiredError') {
        statusCode = 401;
        message = 'Token expired';
    }
    // Extract message if error is a string or has a message property
    if (!message && typeof error === 'string') {
        message = error;
    }
    else if (!message && error.message) {
        message = error.message;
    }
    // Don't expose internal errors in production
    if (process.env.NODE_ENV === 'production' && !apiError.isOperational) {
        message = 'Something went wrong!';
    }
    // Send error response
    res.status(statusCode).json({
        success: false,
        error: Object.assign({ message }, (process.env.NODE_ENV === 'development' && {
            stack: apiError.stack || error.stack,
            details: error
        })),
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
        method: req.method
    });
};
exports.errorHandler = errorHandler;
// Async error wrapper
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
exports.asyncHandler = asyncHandler;
// Create specific error types
const createError = (message, statusCode = 500) => {
    return new AppError(message, statusCode);
};
exports.createError = createError;
const createValidationError = (message) => {
    return new AppError(message, 400);
};
exports.createValidationError = createValidationError;
const createNotFoundError = (resource) => {
    return new AppError(`${resource} not found`, 404);
};
exports.createNotFoundError = createNotFoundError;
const createUnauthorizedError = (message = 'Unauthorized') => {
    return new AppError(message, 401);
};
exports.createUnauthorizedError = createUnauthorizedError;
const createForbiddenError = (message = 'Forbidden') => {
    return new AppError(message, 403);
};
exports.createForbiddenError = createForbiddenError;
