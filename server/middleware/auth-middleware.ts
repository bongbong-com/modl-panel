import { Request, Response, NextFunction } from 'express';

export const BYPASS_DEV_AUTH: boolean = true;

export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  // This middleware is currently disabled
  if (BYPASS_DEV_AUTH) {
    return next();
  }

  console.log('isAuthenticated middleware triggered');
  console.log('Session:', req.session);
  console.log('Cookies:', req.headers.cookie);

  if (req.session && req.session.userId && req.session.email && req.session.username !== undefined && req.session.role !== undefined && req.session.plan_type !== undefined && req.session.subscription_status !== undefined) {
    // User is authenticated and session has all required fields
    req.currentUser = {
      userId: req.session.userId,
      email: req.session.email,
      username: req.session.username,
      role: req.session.role,
      plan_type: req.session.plan_type,
      subscription_status: req.session.subscription_status,
    };
    return next();
  } else {
    // User is not authenticated or session data is incomplete
    // Destroy session if it's partially set but invalid for safety
    if (req.session) {
      req.session.destroy(err => {
        if (err) {
          console.error("Error destroying session:", err);
        }
      });
    }
    return res.status(401).json({ message: 'Unauthorized. Please log in to access this resource.' });
  }
}