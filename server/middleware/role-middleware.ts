import { Request, Response, NextFunction } from 'express';
import { BYPASS_DEV_AUTH } from './auth-middleware';

export const checkRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (BYPASS_DEV_AUTH && process.env.NODE_ENV === 'development') {
      return next();
    }

    if (!req.currentUser || !req.currentUser.role) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const userRole = req.currentUser.role;
    if (roles.includes(userRole)) {
      next();
    } else {
      res.status(403).json({ message: 'Forbidden: You do not have the required permissions.' });
    }
  };
};