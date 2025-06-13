import { Int32 } from 'mongodb'; // Import Int32 from mongodb package
import mongoose from 'mongoose';
const { Schema } = mongoose;

// ========================= OBJECT SCHEMAS =========================
// These are referenced in collections

// Username Schema
const usernameSchema = new Schema({
  username: { type: String, required: true },
  date: { type: Date, default: Date.now } // first login
});

// Note Schema (generic)
const noteSchema = new Schema({
  text: { type: String, required: true },
  date: { type: Date, default: Date.now }, // issued date
  issuerName: { type: String, required: true },
  issuerId: { type: String }
});

// Ticket Note Schema (specific for tickets)
const ticketNoteSchema = new Schema({
  content: { type: String, required: true },
  author: { type: String, required: true },
  date: { type: Date, default: Date.now }
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
  started: { type: Date, default: Date.now },
  type_ordinal: { type: Int32, required: true },
  modifications: [modificationSchema],
  notes: [noteSchema],
  attachedTicketIds: [{ type: String }],
  data: { type: Map, of: mongoose.Schema.Types.Mixed } // HashMap for flexible data
});

// Passkey Schema
const passkeySchema = new Schema({
  credentialID: { type: Buffer, required: true }, // Changed from String to Buffer
  credentialPublicKey: { type: Buffer, required: true }, // Changed from String to Buffer
  counter: { type: Number, required: true }, // Renamed from signCount and made required
  transports: [{ type: String }], // Added transports array
  aaguid: { type: String }, // Optional, from WebAuthn spec
  createdAt: { type: Date, default: Date.now }
});

// Reply Schema
const replySchema = new Schema({
  name: { type: String, required: true },
  content: { type: String, required: true },
  type: { type: String, required: true },
  created: { type: Date, default: Date.now },
  staff: { type: Boolean, default: false },
  action: { type: String } // Add action field for tracking ticket action status
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
  pendingNotifications: [{ type: String }],
  data: { type: Map, of: mongoose.Schema.Types.Mixed } // HashMap for flexible additional data
});

// Staff Collection
const staffSchema = new Schema({
  _id: { type: String }, // Custom staff ID
  email: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  profilePicture: { type: String }, // URL or base64 encoded
  admin: { type: Boolean, default: false },
  twoFaSecret: { type: String },
  isTwoFactorEnabled: { type: Boolean, default: false },
  passkeys: [passkeySchema] // Changed to an array of passkeySchema
});

// Tickets Collection
const ticketSchema = new Schema({
  _id: { type: String }, // Custom ID format: CATEGORY-[6 digit random numeric]
  tags: [{ type: String }],
  type: { 
    type: String, 
    required: true, 
    enum: ['bug', 'player', 'chat', 'appeal', 'staff', 'support'],
    default: 'bug'
  },
  status: { 
    type: String, 
    required: true, 
    enum: ['Unfinished', 'Open', 'Closed'],
    default: 'Unfinished'
  },
  subject: { type: String, default: '' },
  created: { type: Date, default: Date.now },
  creator: { type: String, required: true }, // Username of creator
  creatorUuid: { type: String, required: true }, // UUID of creator
  reportedPlayer: { type: String }, // Username of reported player (for player/chat reports)
  reportedPlayerUuid: { type: String }, // UUID of reported player (for player/chat reports)
  chatMessages: [{ type: String }], // For chat reports
  notes: [ticketNoteSchema],
  replies: [replySchema],
  locked: { type: Boolean, default: false },
  formData: { type: Map, of: mongoose.Schema.Types.Mixed }, // Form responses
  data: { type: Map, of: mongoose.Schema.Types.Mixed } // HashMap for flexible data
});

// Logs Collection
const logSchema = new Schema({
  created: { type: Date, default: Date.now },
  description: { type: String, required: true },
  level: { type: String, enum: ['info', 'warning', 'error', 'moderation'], default: 'info' },
  source: { type: String, default: 'system' }
});

// Form Field Schema
const formFieldSchema = new Schema({
  id: { type: String, required: true },
  label: { type: String, required: true },
  type: { 
    type: String, 
    required: true, 
    enum: ['text', 'textarea', 'select', 'checkbox', 'radio']
  },
  required: { type: Boolean, default: false },
  options: [{ type: String }], // For select, checkbox, radio types
  placeholder: { type: String },
  helpText: { type: String }
});

// Form Template Schema
const formTemplateSchema = new Schema({
  ticketType: { 
    type: String, 
    required: true, 
    enum: ['bug', 'player', 'chat', 'staff', 'support'] 
  },
  title: { type: String, required: true },
  description: { type: String },
  fields: [formFieldSchema]
});

// Settings Collection
const settingsSchema = new Schema({
  formTemplates: [formTemplateSchema],
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
  Settings,
  // Export raw schemas
  playerSchema,
  staffSchema,
  ticketSchema,
  logSchema,
  settingsSchema,
  // also export other schemas if they are needed by connectionManager for model registration
  usernameSchema,
  noteSchema,
  ticketNoteSchema,
  ipAddressSchema,
  modificationSchema,
  punishmentSchema,
  passkeySchema,
  replySchema,
  formFieldSchema,
  formTemplateSchema
};