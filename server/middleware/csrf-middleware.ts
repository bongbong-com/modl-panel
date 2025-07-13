import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

declare global {
  namespace Express {
    interface Request {
      csrfToken?: () => string;
    }
  }
}

interface CSRFOptions {
  ignoreMethods?: string[];
  secret?: string;
}

// Simple CSRF implementation for this application
export const csrfProtection = (options: CSRFOptions = {}) => {
  const { ignoreMethods = ['GET', 'HEAD', 'OPTIONS'], secret = 'csrf-secret' } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    // Skip CSRF for safe methods
    if (ignoreMethods.includes(req.method)) {
      // Generate token for safe methods so it can be used in forms
      req.csrfToken = () => generateCSRFToken(req, secret);
      return next();
    }

    // For state-changing methods, verify CSRF token
    const token = req.headers['x-csrf-token'] as string || req.body._csrf;
    
    if (!token) {
      return res.status(403).json({ 
        error: 'CSRF token missing',
        message: 'CSRF protection requires a token for state-changing requests'
      });
    }

    if (!verifyCSRFToken(req, token, secret)) {
      return res.status(403).json({ 
        error: 'CSRF token invalid',
        message: 'Invalid CSRF token'
      });
    }

    req.csrfToken = () => generateCSRFToken(req, secret);
    next();
  };
};

function generateCSRFToken(req: Request, secret: string): string {
  // Use session ID + secret to generate token
  const sessionId = req.session?.id || 'no-session';
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(sessionId);
  return hmac.digest('hex');
}

function verifyCSRFToken(req: Request, token: string, secret: string): boolean {
  const expectedToken = generateCSRFToken(req, secret);
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expectedToken));
}

// Middleware to add CSRF token to responses
export const addCSRFToken = (req: Request, res: Response, next: NextFunction) => {
  if (req.csrfToken) {
    res.locals.csrfToken = req.csrfToken();
  }
  next();
};