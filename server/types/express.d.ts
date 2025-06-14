// filepath: server\types\express.d.ts
import { Connection, Document } from 'mongoose';
import { Session, SessionData } from 'express-session'; // Import Session and SessionData

// Define an interface for the ModlServer document
interface IModlServer extends Document {
  adminEmail: string;
  serverName: string;
  customDomain: string;
  plan_type: 'free' | 'premium';
  emailVerified: boolean;
  provisioningStatus: 'pending' | 'in-progress' | 'completed' | 'failed';
  databaseName?: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  subscription_status: 'active' | 'canceled' | 'past_due' | 'inactive';
  current_period_end?: Date;
}
declare global {
  namespace Express {
    interface UserProfile {
      id: string;
      email: string;
      username: string;
      role: string;
    }    interface Request {
      serverDbConnection?: Connection;
      serverName?: string;
      modlServer?: IModlServer; // Holds the server config from the global DB
      user?: UserProfile; // For general user object, if populated by other means
      session: Session & Partial<SessionData> & { // Use imported Session and SessionData
        userId?: string;
        email?: string;
        username?: string;
        role?: string;
        admin?: boolean; // Add admin flag for provisioning flow
      };
      currentUser?: { // Add this for strongly-typed session user info
        userId: string;
        email: string;
        username: string;
        role: string;
      };
      staffId?: string;
    }
  }
}

// This empty export makes the file a module, which is necessary for ambient declarations like this.
export {};
