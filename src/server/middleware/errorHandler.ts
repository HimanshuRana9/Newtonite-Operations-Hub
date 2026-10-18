import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  // 1. Zod Validation Error
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message
      }))
    });
  }

  // 2. Custom Application Error with HTTP statusCode
  if (err.statusCode && typeof err.statusCode === 'number') {
    return res.status(err.statusCode).json({
      error: err.message || 'Operation failed'
    });
  }

  // 3. Prisma Unique Constraint Violation
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({
        error: 'Conflict: A unique constraint violation occurred',
        target: err.meta?.target
      });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({
        error: 'Resource not found'
      });
    }
  }

  console.error('[Unhandled Error]', err);
  return res.status(500).json({
    error: 'Internal server error'
  });
}
