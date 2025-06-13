import { Int32 } from 'mongodb';
import mongoose from 'mongoose';
const { Schema } = mongoose;

const usernameSchema = new Schema({
  username: { type: String, required: true },
  date: { type: Date, default: Date.now }
});

const noteSchema = new Schema({
  text: { type: String, required: true },
  date: { type: Date, default: Date.now },
  issuerName: { type: String, required: true },
  issuerId: { type: String }
});

const ticketNoteSchema = new Schema({
  content: { type: String, required: true },
  author: { type: String, required: true },
  date: { type: Date, default: Date.now }
});

const ipAddressSchema = new Schema({
  ipAddress: { type: String, required: true },
  country: { type: String },
  region: { type: String },
  asn: { type: String },
  firstLogin: { type: Date, default: Date.now },
  logins: [{ type: Date }]
});

const modificationSchema = new Schema({
  type: { type: String, required: true },
  issuerName: { type: String, required: true },
  issued: { type: Date, default: Date.now },
  effectiveDuration: { type: Number }
});

const punishmentSchema = new Schema({
  id: { type: String, required: true },
  issuerName: { type: String, required: true },
  issued: { type: Date, default: Date.now },
  started: { type: Date, default: Date.now },
  type_ordinal: { type: Int32, required: true },
  modifications: [modificationSchema],
  notes: [noteSchema],
  attachedTicketIds: [{ type: String }],
  data: { type: Map, of: mongoose.Schema.Types.Mixed }
});

const passkeySchema = new Schema({
  credentialID: { type: Buffer, required: true },
  credentialPublicKey: { type: Buffer, required: true },
  counter: { type: Number, required: true },
  transports: [{ type: String }],
  aaguid: { type: String },
  createdAt: { type: Date, default: Date.now }
});

const replySchema = new Schema({
  name: { type: String, required: true },
  content: { type: String, required: true },
  type: { type: String, required: true },
  created: { type: Date, default: Date.now },
  staff: { type: Boolean, default: false },
  action: { type: String }
});

const playerSchema = new Schema({
  _id: { type: String },
  minecraftUuid: { type: String, required: true, unique: true },
  usernames: [usernameSchema],
  notes: [noteSchema],
  ipList: [ipAddressSchema],
  punishments: [punishmentSchema],
  pendingNotifications: [{ type: String }],
  data: { type: Map, of: mongoose.Schema.Types.Mixed }
});

const staffSchema = new Schema({
  _id: { type: String },
  email: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  profilePicture: { type: String },
  admin: { type: Boolean, default: false },
  twoFaSecret: { type: String },
  isTwoFactorEnabled: { type: Boolean, default: false },
  passkeys: [passkeySchema]
});

const ticketSchema = new Schema({
  _id: { type: String },
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
  creator: { type: String, required: true },
  creatorUuid: { type: String, required: true },
  reportedPlayer: { type: String },
  reportedPlayerUuid: { type: String },
  chatMessages: [{ type: String }],
  notes: [ticketNoteSchema],
  replies: [replySchema],
  locked: { type: Boolean, default: false },
  formData: { type: Map, of: mongoose.Schema.Types.Mixed },
  data: { type: Map, of: mongoose.Schema.Types.Mixed }
});

const logSchema = new Schema({
  created: { type: Date, default: Date.now },
  description: { type: String, required: true },
  level: { type: String, enum: ['info', 'warning', 'error', 'moderation'], default: 'info' },
  source: { type: String, default: 'system' }
});

const formFieldSchema = new Schema({
  id: { type: String, required: true },
  label: { type: String, required: true },
  type: {
    type: String,
    required: true,
    enum: ['text', 'textarea', 'select', 'checkbox', 'radio']
  },
  required: { type: Boolean, default: false },
  options: [{ type: String }],
  placeholder: { type: String },
  helpText: { type: String }
});

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

const settingsSchema = new Schema({
  formTemplates: [formTemplateSchema],
  settings: { type: Map, of: mongoose.Schema.Types.Mixed }
});

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
  playerSchema,
  staffSchema,
  ticketSchema,
  logSchema,
  settingsSchema,
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