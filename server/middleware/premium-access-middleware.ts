import { Request, Response, NextFunction } from 'express';
import { BYPASS_DEV_AUTH } from './auth-middleware';
import { connectToGlobalModlDb } from '../db/connectionManager';
import { ModlServerSchema } from '../models/modl-global-schemas';

export const checkPremiumAccess = async (req: Request, res: Response, next: NextFunction) => {
  if (BYPASS_DEV_AUTH && process.env.NODE_ENV === 'development') {
    return next();
  }

  const serverName = req.serverName;
  if (!serverName) {
    return res.status(400).json({ message: 'Server context not found.' });
  }

  try {
    const globalDb = await connectToGlobalModlDb();
    const Server = globalDb.model('ModlServer', ModlServerSchema);
    const server = await Server.findOne({ customDomain: serverName });

    if (!server) {
      return res.status(404).json({ message: 'Server not found.' });
    }

    if (server.plan_type === 'premium' && server.subscription_status === 'active') {
      next();
    } else {
      res.status(403).json({ message: 'Access denied. A premium subscription is required.' });
    }
  } catch (error) {
    console.error('Error in premium access middleware:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};