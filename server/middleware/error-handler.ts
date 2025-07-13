import { Request, Response, NextFunction } from 'express';

/**
 * SECURITY: Centralized error handling to prevent information disclosure
 */

interface ErrorResponse {
  error: string;
  message: string;
  details?: any; // Only in development
}

/**
 * Safe error response that doesn't expose internal details
 */
export function createSafeErrorResponse(error: any, userMessage?: string): ErrorResponse {
  // Always return user-friendly messages only
  const response: ErrorResponse = {
    error: 'Internal server error',
    message: userMessage || 'An error occurred while processing your request'
  };
  
  // Log the full error server-side for debugging (but never expose to client)
  console.error('Server Error:', {
    message: error?.message,
    stack: error?.stack,
    timestamp: new Date().toISOString()
  });
  
  return response;
}

/**
 * Database error handler that maps common errors to user-friendly messages
 */
export function handleDatabaseError(error: any): ErrorResponse {
  // MongoDB/Mongoose specific errors
  if (error.name === 'ValidationError') {
    return {
      error: 'Validation failed',
      message: 'The provided data is invalid. Please check your input and try again.'
    };
  }
  
  if (error.name === 'CastError') {
    return {
      error: 'Invalid data format',
      message: 'The provided data format is incorrect.'
    };
  }
  
  if (error.code === 11000) { // Duplicate key error
    return {
      error: 'Duplicate entry',
      message: 'This entry already exists.'
    };
  }
  
  if (error.name === 'MongoNetworkError' || error.name === 'MongoTimeoutError') {
    return {
      error: 'Database connection error',
      message: 'Unable to connect to the database. Please try again later.'
    };
  }
  
  // Default to generic database error
  return createSafeErrorResponse(error, 'A database error occurred');
}

/**
 * Authentication error handler
 */
export function handleAuthError(error: any): ErrorResponse {
  return {
    error: 'Authentication failed',
    message: 'Your session has expired or is invalid. Please log in again.'
  };
}

/**
 * File upload error handler
 */
export function handleFileUploadError(error: any): ErrorResponse {
  if (error.code === 'LIMIT_FILE_SIZE') {
    return {
      error: 'File too large',
      message: 'The uploaded file exceeds the maximum allowed size.'
    };
  }
  
  if (error.code === 'LIMIT_FILE_COUNT') {
    return {
      error: 'Too many files',
      message: 'You can only upload one file at a time.'
    };
  }
  
  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    return {
      error: 'Invalid file field',
      message: 'The file was uploaded to an unexpected field.'
    };
  }
  
  return createSafeErrorResponse(error, 'File upload failed');
}

/**
 * Express error handling middleware
 */
export const errorHandler = (error: any, req: Request, res: Response, next: NextFunction) => {
  // Handle different types of errors
  let errorResponse: ErrorResponse;
  
  if (error.name === 'MulterError') {
    errorResponse = handleFileUploadError(error);
  } else if (error.name === 'ValidationError' || error.name === 'CastError' || error.code === 11000) {
    errorResponse = handleDatabaseError(error);
  } else if (error.status === 401 || error.name === 'UnauthorizedError') {
    errorResponse = handleAuthError(error);
  } else {
    errorResponse = createSafeErrorResponse(error);
  }
  
  // Set appropriate status code
  const statusCode = error.status || error.statusCode || 500;
  
  res.status(statusCode).json(errorResponse);
};

/**
 * Async handler wrapper to catch async errors
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 404 handler for unmatched routes
 */
export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not found',
    message: 'The requested resource was not found'
  });
};