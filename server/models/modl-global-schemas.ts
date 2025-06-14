import mongoose from 'mongoose';
const { Schema } = mongoose;

// Schema for the 'servers' collection in the 'modl' database
const ModlServerSchema = new Schema({
  adminEmail: { type: String, required: true },
  serverName: { type: String, required: true, unique: true },
  customDomain: { type: String, required: true, unique: true }, // This will be the subdomain
  plan: { type: String, required: true, enum: ['free', 'paid'] }, // Added enum for plan
  emailVerificationToken: { type: String, unique: true, sparse: true }, // Made optional, unique only when a value is present
  emailVerified: { type: Boolean, default: false },
  provisioningSignInToken: { type: String, unique: true, sparse: true }, // For secure auto-login post-provisioning
  provisioningSignInTokenExpiresAt: { type: Date }, // Expiry for the sign-in token
  provisioningStatus: { type: String, enum: ['pending', 'in-progress', 'completed', 'failed'], default: 'pending' }, // To track provisioning
  databaseName: { type: String }, // To store the name of the server's dedicated DB
  provisioningNotes: { type: String }, // To store any notes or error messages during provisioning
  stripe_customer_id: { type: String, unique: true, sparse: true },
  stripe_subscription_id: { type: String, unique: true, sparse: true },
  plan_type: {
    type: String,
    enum: ['free', 'premium'],
    default: 'free'
  },  subscription_status: {
    type: String,
    enum: [
      'active', 
      'canceled', 
      'incomplete', 
      'incomplete_expired', 
      'past_due', 
      'trialing', 
      'unpaid', 
      'paused',
      'inactive'
    ],
    default: 'inactive'
  },
  current_period_end: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { collection: 'servers' }); // Explicitly set the collection name

// Pre-save hook to update 'updatedAt'
ModlServerSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export { ModlServerSchema };
