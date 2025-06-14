import { Request, Response, NextFunction } from 'express';
import { BYPASS_DEV_AUTH } from './auth-middleware';
import { connectToGlobalModlDb } from '../db/connectionManager';
import { ModlServerSchema } from '../models/modl-global-schemas';

export const checkPremiumAccess = async (req: Request, res: Response, next: NextFunction) => {
  return next();
};