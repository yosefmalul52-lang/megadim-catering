import { Request, Response } from 'express';

export const notFoundHandler = (req: Request, res: Response): void => {
  const message = `Route ${req.originalUrl} not found`;
  
  console.log(`⚠️  404 - ${message}`);
  console.log(`Method: ${req.method}, IP: ${req.ip}, User-Agent: ${req.get('User-Agent')}`);

  res.status(404).json({
    success: false,
    error: {
      message,
      statusCode: 404
    },
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    method: req.method,
    suggestion: 'Please check the API documentation for available endpoints'
  });
};
