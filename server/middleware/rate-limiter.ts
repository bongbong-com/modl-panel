import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';

// Global rate limit: 200 requests per minute per IP
export const globalRateLimit: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200, // Limit each IP to 200 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: 60
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Skip successful responses from the count
  skipSuccessfulRequests: false,
  // Skip failed responses from the count
  skipFailedRequests: false,
  // Custom key generator to use IP address
  keyGenerator: (req) => {
    // Use forwarded IP if behind a proxy, otherwise use connection remote address
    return req.ip || req.connection.remoteAddress || 'unknown';
  },
  // Add handler for when rate limit is exceeded
  handler: (req, res) => {
    console.log(`[RATE LIMIT] Global rate limit exceeded for IP: ${req.ip || 'unknown'} on ${req.method} ${req.path}`);
    res.status(429).json({
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: 60
    });
  }
});

// Strict rate limit for registration and email verification: 1 request per minute per IP
export const strictRateLimit: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 1, // Limit each IP to 1 request per windowMs
  message: {
    error: 'Rate limit exceeded for this sensitive endpoint. Please wait before trying again.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress || 'unknown';
  },
  handler: (req, res) => {
    console.log(`[RATE LIMIT] Strict rate limit exceeded for IP: ${req.ip || 'unknown'} on ${req.method} ${req.path}`);
    res.status(429).json({
      error: 'Rate limit exceeded for this sensitive endpoint. Please wait before trying again.',
      retryAfter: 60
    });
  }
});

// Medium rate limit for authentication endpoints: 10 requests per minute per IP
export const authRateLimit: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 requests per windowMs
  message: {
    error: 'Too many authentication attempts from this IP, please try again later.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress || 'unknown';
  },
  handler: (req, res) => {
    console.log(`[RATE LIMIT] Auth rate limit exceeded for IP: ${req.ip || 'unknown'} on ${req.method} ${req.path}`);
    res.status(429).json({
      error: 'Too many authentication attempts from this IP, please try again later.',
      retryAfter: 60
    });
  }
});
