import mongoose from 'mongoose';
const { Schema } = mongoose;

// ========================= OBJECT SCHEMAS =========================
// These are referenced in collections

// Username Schema
const usernameSchema = new Schema({
  username: { type: String, required: true },
  date: { type: Date, default: Date.now } // first login
});

// Note Schema
const noteSchema = new Schema({
  text: { type: String, required: true },
  date: { type: Date, default: Date.now }, // issued date
  issuerName: { type: String, required: true }
});

// IP Address Schema
const ipAddressSchema = new Schema({
  ipAddress: { type: String, required: true },
  country: { type: String },
  region: { type: String },
  asn: { type: String },
  firstLogin: { type: Date, default: Date.now },
  logins: [{ type: Date }]
});

// Modification Schema
const modificationSchema = new Schema({
  type: { type: String, required: true },
  issuerName: { type: String, required: true },
  issued: { type: Date, default: Date.now },
  effectiveDuration: { type: Number } // long value in milliseconds
});

// Punishment Schema
const punishmentSchema = new Schema({
  id: { type: String, required: true }, // 8-char alphanumeric
  issuerName: { type: String, required: true },
  issued: { type: Date, default: Date.now },
  started: { type: Date },
  type: { type: String, required: true },
  modifications: [modificationSchema],
  notes: [{ type: String }],
  attachedTicketIds: [{ type: String }],
  data: { type: Map, of: mongoose.Schema.Types.Mixed } // HashMap for flexible data
});

// Passkey Schema
const passkeySchema = new Schema({
  credentialId: { type: String, required: true },
  publicKey: { type: String, required: true },
  signCount: { type: Number, default: 0 },
  aaguid: { type: String },
  createdAt: { type: Date, default: Date.now }
});

// Reply Schema
const replySchema = new Schema({
  name: { type: String, required: true },
  content: { type: String, required: true },
  type: { type: String, required: true },
  created: { type: Date, default: Date.now },
  staff: { type: Boolean, default: false }
});

// ========================= COLLECTION SCHEMAS =========================

// Players Collection
const playerSchema = new Schema({
  _id: { type: String }, // Account ID (UUID), generated upon creation
  minecraftUuid: { type: String, required: true, unique: true },
  usernames: [usernameSchema],
  notes: [noteSchema],
  ipList: [ipAddressSchema],
  punishments: [punishmentSchema],
  pendingNotifications: [{ type: String }]
});

// Staff Collection
const staffSchema = new Schema({
  email: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  profilePicture: { type: String }, // base64 encoded
  admin: { type: Boolean, default: false },
  twoFaSecret: { type: String },
  passkey: passkeySchema
});

// Tickets Collection
const ticketSchema = new Schema({
  _id: { type: String }, // Custom ID format: CATEGORY-[6 digit random numeric]
  tags: [{ type: String }],
  created: { type: Date, default: Date.now },
  creator: { type: String, required: true }, // UUID of creator
  notes: [noteSchema],
  replies: [replySchema],
  data: { type: Map, of: mongoose.Schema.Types.Mixed } // HashMap for flexible data
});

// Logs Collection
const logSchema = new Schema({
  created: { type: Date, default: Date.now },
  description: { type: String, required: true }
});

// Settings Collection
const settingsSchema = new Schema({
  settings: { type: Map, of: mongoose.Schema.Types.Mixed }
});

// Create and export models
const Player = mongoose.model('Player', playerSchema);
const Staff = mongoose.model('Staff', staffSchema);
const Ticket = mongoose.model('Ticket', ticketSchema);
const Log = mongoose.model('Log', logSchema);
const Settings = mongoose.model('Settings', settingsSchema);

export {
  Player,
  Staff,
  Ticket,
  Log,
  Settings
};