import { Request, Response, NextFunction } from 'express';
import { BYPASS_DEV_AUTH } from './auth-middleware';

export const checkPremiumAccess = (req: Request, res: Response, next: NextFunction) => {
  if (BYPASS_DEV_AUTH && process.env.NODE_ENV === 'development') {
    return next();
  }

  if (!req.currentUser) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  const { plan_type, subscription_status } = req.currentUser;

  if (plan_type === 'premium' && subscription_status === 'active') {
    next();
  } else {
    res.status(403).json({ message: 'Access denied. A premium subscription is required.' });
  }
};