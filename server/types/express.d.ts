// filepath: server\types\express.d.ts
import { Connection } from 'mongoose';

declare global {
  namespace Express {
    interface Request {
      serverDbConnection?: Connection;
      serverName?: string;
    }
  }
}

// This empty export makes the file a module, which is necessary for ambient declarations like this.
export {};
