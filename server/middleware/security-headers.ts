import { Request, Response, NextFunction } from 'express';

/**
 * Security headers middleware to protect against common attacks
 */
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Prevent clickjacking attacks
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Content Security Policy - production-ready strict policy
  const csp = [
    "default-src 'self'",
    "script-src 'self'", // Remove unsafe-inline and unsafe-eval for production
    "style-src 'self'", // Remove unsafe-inline for production
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https:", // Remove websockets, only allow HTTPS
    "frame-ancestors 'none'", // Additional clickjacking protection
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'", // Prevent Flash/plugin execution
    "media-src 'self'"
  ].join('; ');
  
  res.setHeader('Content-Security-Policy', csp);
  
  // Referrer Policy - limit referrer information
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions Policy - restrict browser features
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  
  // Strict Transport Security - always enforce HTTPS
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  
  next();
};