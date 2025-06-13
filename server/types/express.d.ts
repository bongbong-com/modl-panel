// filepath: server\types\express.d.ts
import { Connection } from 'mongoose';
import { Session, SessionData } from 'express-session'; // Import Session and SessionData

declare global {
  namespace Express {
    interface UserProfile {
      id: string;
      email: string;
      username: string;
      role: string;
    }
    interface Request {
      serverDbConnection?: Connection;
      serverName?: string;
      user?: UserProfile; // For general user object, if populated by other means
      session: Session & Partial<SessionData> & { // Use imported Session and SessionData
        userId?: string;
        email?: string;
        username?: string;
        role?: string;
      };
      currentUser?: { // Add this for strongly-typed session user info
        userId: string;
        email: string;
        username: string;
        role: string;
      };
    }
  }
}

// This empty export makes the file a module, which is necessary for ambient declarations like this.
export {};
