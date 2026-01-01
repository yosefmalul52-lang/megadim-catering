import { Request, Response, NextFunction } from 'express';

export interface ApiError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export class AppError extends Error implements ApiError {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Explicit error handler function with proper Express signature
export const errorHandler: (error: any, req: Request, res: Response, next: NextFunction) => void = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Type guard to check if error has statusCode
  const apiError = error as ApiError;
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
  } else if (error.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid data format';
  } else if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  } else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  // Extract message if error is a string or has a message property
  if (!message && typeof error === 'string') {
    message = error;
  } else if (!message && error.message) {
    message = error.message;
  }

  // Don't expose internal errors in production
  if (process.env.NODE_ENV === 'production' && !apiError.isOperational) {
    message = 'Something went wrong!';
  }

  // Send error response
  res.status(statusCode).json({
    success: false,
    error: {
      message,
      ...(process.env.NODE_ENV === 'development' && {
        stack: apiError.stack || error.stack,
        details: error
      })
    },
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    method: req.method
  });
};

// Async error wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Create specific error types
export const createError = (message: string, statusCode: number = 500): AppError => {
  return new AppError(message, statusCode);
};

export const createValidationError = (message: string): AppError => {
  return new AppError(message, 400);
};

export const createNotFoundError = (resource: string): AppError => {
  return new AppError(`${resource} not found`, 404);
};

export const createUnauthorizedError = (message: string = 'Unauthorized'): AppError => {
  return new AppError(message, 401);
};

export const createForbiddenError = (message: string = 'Forbidden'): AppError => {
  return new AppError(message, 403);
};
